import { OutsideSession, insertSession, getSessionsForRange, deleteSession } from '../storage/database';
import { computeSessionScore, DISCARD_CONFIDENCE_THRESHOLD } from './sessionConfidence';

const MERGE_GAP_MS = 5 * 60 * 1000; // sessions within 5 min of each other get merged

/**
 * Submit a candidate session from any detection source.
 * Manual sessions are always inserted as standalone entries — the user is the
 * authoritative source and their explicit log should never be merged with or
 * altered by auto-detected sessions.
 * For automated sources (GPS, Health Connect, timeline):
 *   - Any overlapping unconfirmed (userConfirmed is null or 0) session is merged
 *     into one session spanning the full combined time range (highest confidence).
 *   - Confirmed sessions (userConfirmed === 1, of any source) are never deleted or
 *     modified.  Instead the new session is split around them and each remaining
 *     segment is inserted as unconfirmed for user review.
 *   - A denied (userConfirmed === 0) status from an existing unconfirmed session is
 *     preserved in the merged result so a re-detection does not override a "no".
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

  // For non-manual candidates: confirmed sessions (userConfirmed === 1) must never
  // be touched by automated detection regardless of their source (gps, health_connect, …).
  // Manual sessions are already handled above; any that appear in `existing` here
  // will also have userConfirmed === 1 and are therefore protected by the same path.
  const confirmedSessions = existing.filter(s => s.userConfirmed === 1);
  const unconfirmedSessions = existing.filter(s => s.userConfirmed !== 1);

  // Merge all unconfirmed overlapping sessions and the candidate into one range.
  const allUnconfirmed = [...unconfirmedSessions, candidate];
  const mergedStart = Math.min(...allUnconfirmed.map(s => s.startTime));
  const mergedEnd   = Math.max(...allUnconfirmed.map(s => s.endTime));
  const mergedConfidence = Math.max(...allUnconfirmed.map(s => s.confidence));

  // Preserve a denied (userConfirmed=0) status from existing unconfirmed sessions
  // so that a re-detection never silently un-denies a session.
  const deniedSession = unconfirmedSessions.find(s => s.userConfirmed === 0);

  // Delete all existing unconfirmed sessions in the overlap window.
  unconfirmedSessions.forEach(session => {
    if (session.id) {
      deleteSession(session.id);
    }
  });

  // Subtract confirmed session time from the merged range so that confirmed user
  // data is never overwritten.  Each remaining gap becomes an unconfirmed segment.
  const sortedConfirmed = [...confirmedSessions]
    .filter(s => s.startTime < mergedEnd && s.endTime > mergedStart)
    .sort((a, b) => a.startTime - b.startTime);

  if (sortedConfirmed.length > 0) {
    console.log(`TouchGrass: Session split around ${sortedConfirmed.length} confirmed session(s)`);
  }

  const segments: Array<[number, number]> = [];
  let cursor = mergedStart;

  for (const confirmed of sortedConfirmed) {
    if (confirmed.startTime > cursor) {
      segments.push([cursor, confirmed.startTime]);
    }
    cursor = Math.max(cursor, confirmed.endTime);
  }
  if (cursor < mergedEnd) {
    segments.push([cursor, mergedEnd]);
  }

  if (sortedConfirmed.length > 0) {
    console.log(`TouchGrass: Session split result: ${segments.length} segment(s) after subtracting confirmed ranges`);
    segments.forEach(([s, e], idx) => {
      console.log(`  Segment ${idx}: ${new Date(s).toISOString()} – ${new Date(e).toISOString()} (${Math.round((e - s) / 60000)} min)`);
    });
  }

  for (const [segStart, segEnd] of segments) {
    const segSession: OutsideSession = {
      ...candidate,
      startTime: segStart,
      endTime: segEnd,
      durationMinutes: (segEnd - segStart) / 60000,
      confidence: mergedConfidence,
      userConfirmed: deniedSession ? 0 : null,
      discarded: 0,
    };
    const score = computeSessionScore(segSession);
    // Only discard sessions that have no user feedback yet (userConfirmed === null).
    // Sessions the user explicitly denied (userConfirmed === 0) keep discarded=0 so
    // their rejection is preserved and visible in the Standard tab.
    const shouldDiscard =
      segSession.userConfirmed === null &&
      score < DISCARD_CONFIDENCE_THRESHOLD;
    if (shouldDiscard) {
      console.log(`TouchGrass: Session discarded (score ${score.toFixed(2)} < threshold ${DISCARD_CONFIDENCE_THRESHOLD}): ${new Date(segStart).toISOString()} – ${new Date(segEnd).toISOString()} source=${candidate.source}`);
    }
    insertSession({
      ...segSession,
      confidence: score,  // store computed score so the UI reflects actual confidence
      discarded: shouldDiscard ? 1 : 0,
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
    discarded: 0,
  };
}
