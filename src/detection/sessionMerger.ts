import { OutsideSession, insertSession, getSessionsForRange, deleteSession } from '../storage/database';

const MERGE_GAP_MS = 5 * 60 * 1000; // sessions within 5 min of each other get merged

/**
 * Submit a candidate session from any detection source.
 * If an overlapping session already exists, keep the one with higher confidence.
 * If sessions are close together (within MERGE_GAP_MS), merge them.
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

  // Find the best existing session to compare against
  const best = existing.reduce((a, b) => a.confidence > b.confidence ? a : b);

  if (candidate.confidence > best.confidence) {
    // New candidate wins — delete old sessions and insert the new one
    existing.forEach(session => {
      if (session.id) {
        deleteSession(session.id);
      }
    });
    insertSession({ ...candidate, userConfirmed: null });
  }
  // else: existing session wins, discard candidate silently
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
    userConfirmed: null,
    notes,
  };
}
