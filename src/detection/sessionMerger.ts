import { OutsideSession, insertSession, getSessionsForRange, deleteSession } from '../storage/database';

const MERGE_GAP_MS = 5 * 60 * 1000; // sessions within 5 min of each other get merged

/**
 * Submit a candidate session from any detection source.
 * If an overlapping or adjacent session already exists, merge all of them
 * into one session that spans the full combined time range (using the highest
 * confidence among all merged sessions).  Existing user confirmations are
 * preserved so that a GPS/Health-Connect top-up never resets a "confirmed"
 * or "denied" decision.
 */
export function submitSession(candidate: OutsideSession): void {
  const windowStart = candidate.startTime - MERGE_GAP_MS;
  const windowEnd = candidate.endTime + MERGE_GAP_MS;
  const existing = getSessionsForRange(windowStart, windowEnd);

  if (existing.length === 0) {
    // No overlap — insert as new session
    insertSession(candidate);
    return;
  }

  // Merge all overlapping sessions and the candidate into one session
  const allSessions = [...existing, candidate];
  const mergedStart = Math.min(...allSessions.map(s => s.startTime));
  const mergedEnd   = Math.max(...allSessions.map(s => s.endTime));
  const mergedConfidence = Math.max(...allSessions.map(s => s.confidence));

  // Preserve any existing user confirmation so user decisions are never lost
  const confirmedSession = existing.find(s => s.userConfirmed !== null);

  // Delete all existing sessions in the overlap window
  existing.forEach(session => {
    if (session.id) {
      deleteSession(session.id);
    }
  });

  insertSession({
    ...candidate,
    startTime: mergedStart,
    endTime: mergedEnd,
    durationMinutes: (mergedEnd - mergedStart) / 60000,
    confidence: mergedConfidence,
    userConfirmed: confirmedSession ? confirmedSession.userConfirmed : null,
  });
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
