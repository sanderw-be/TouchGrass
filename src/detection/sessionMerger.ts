import { OutsideSession, insertSession, getSessionsForRange, deleteSession } from '../storage/database';

const MERGE_GAP_MS = 5 * 60 * 1000; // sessions within 5 min of each other get merged

/**
 * Submit a candidate session from any detection source.
 * Manual sessions are always inserted as standalone entries — the user is the
 * authoritative source and their explicit log should never be merged with or
 * altered by auto-detected sessions.
 * For automated sources (GPS, Health Connect, timeline) any overlapping or
 * adjacent session is merged into one session spanning the full combined time
 * range (using the highest confidence).  Existing user confirmations are
 * preserved so a top-up never resets a "confirmed" or "denied" decision.
 */
export function submitSession(candidate: OutsideSession): void {
  // Manual sessions bypass merging — insert directly as a separate entry.
  if (candidate.source === 'manual') {
    insertSession(candidate);
    return;
  }

  const windowStart = candidate.startTime - MERGE_GAP_MS;
  const windowEnd = candidate.endTime + MERGE_GAP_MS;
  const existing = getSessionsForRange(windowStart, windowEnd);

  // Manual sessions must never be modified by automated detection — separate them out.
  const manualSessions = existing.filter(s => s.source === 'manual');
  const nonManualSessions = existing.filter(s => s.source !== 'manual');

  // Merge all non-manual overlapping sessions and the candidate into one session
  const allNonManual = [...nonManualSessions, candidate];
  const mergedStart = Math.min(...allNonManual.map(s => s.startTime));
  const mergedEnd   = Math.max(...allNonManual.map(s => s.endTime));
  const mergedConfidence = Math.max(...allNonManual.map(s => s.confidence));

  // Preserve any existing user confirmation so user decisions are never lost
  const confirmedSession = nonManualSessions.find(s => s.userConfirmed !== null);

  // Delete all existing non-manual sessions in the overlap window
  nonManualSessions.forEach(session => {
    if (session.id) {
      deleteSession(session.id);
    }
  });

  // Subtract manual session time from the merged range so that confirmed user
  // data is never overwritten.  Each remaining gap becomes a GPS segment.
  const sortedManuals = [...manualSessions]
    .filter(s => s.startTime < mergedEnd && s.endTime > mergedStart)
    .sort((a, b) => a.startTime - b.startTime);

  const segments: Array<[number, number]> = [];
  let cursor = mergedStart;

  for (const manual of sortedManuals) {
    if (manual.startTime > cursor) {
      segments.push([cursor, manual.startTime]);
    }
    cursor = Math.max(cursor, manual.endTime);
  }
  if (cursor < mergedEnd) {
    segments.push([cursor, mergedEnd]);
  }

  for (const [segStart, segEnd] of segments) {
    insertSession({
      ...candidate,
      startTime: segStart,
      endTime: segEnd,
      durationMinutes: (segEnd - segStart) / 60000,
      confidence: mergedConfidence,
      userConfirmed: confirmedSession ? confirmedSession.userConfirmed : null,
    });
  }
}

/**
 * Build a session object from raw start/end times and source.
 */
export function buildSession(
  startTime: number,
  endTime: number,
  source: OutsideSession['source'],
  confidence: number,
  notes?: string,
): OutsideSession {
  const durationMinutes = (endTime - startTime) / 60000;
  return {
    startTime,
    endTime,
    durationMinutes,
    source,
    confidence,
    userConfirmed: source === 'manual' ? 1 : null, // Auto-approve manual sessions
    notes,
  };
}
