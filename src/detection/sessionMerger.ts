import {
  OutsideSession,
  insertSessionAsync,
  insertSessionsBatchAsync,
  getSessionsForRangeAsync,
  deleteSessionsByIdsAsync,
} from '../storage/database';
import {
  computeSessionScoreFromProbs,
  loadTimeSlotProbabilities,
  DISCARD_CONFIDENCE_THRESHOLD,
} from './sessionConfidence';
import { t } from '../i18n';
import { isImperialUnits, kmhToMph } from '../utils/units';

const MERGE_GAP_MS = 5 * 60 * 1000; // sessions within 5 min of each other get merged

// Step-to-speed constants shared with healthConnect.ts (kept local to avoid circular imports).
// 110 steps/min ≈ 5 km/h at an average walking cadence.
const STEPS_PER_MIN_AT_BASELINE = 110;
const BASELINE_SPEED_KMH = 5;
const MS_PER_HOUR = 3_600_000;
const METERS_PER_KM = 1_000;

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
export async function submitSession(candidate: OutsideSession): Promise<void> {
  // Manual sessions bypass merging — insert directly as a separate entry.
  if (candidate.source === 'manual') {
    await insertSessionAsync(candidate);
    return;
  }

  const windowStart = candidate.startTime - MERGE_GAP_MS;
  const windowEnd = candidate.endTime + MERGE_GAP_MS;
  const existing = await getSessionsForRangeAsync(windowStart, windowEnd);

  // For non-manual candidates: confirmed sessions (userConfirmed === 1) must never
  // be touched by automated detection regardless of their source (gps, health_connect, …).
  // Manual sessions are already handled above; any that appear in `existing` here
  // will also have userConfirmed === 1 and are therefore protected by the same path.
  const confirmedSessions = existing.filter((s) => s.userConfirmed === 1);
  const unconfirmedSessions = existing.filter((s) => s.userConfirmed !== 1);

  // Merge all unconfirmed overlapping sessions and the candidate into one range.
  const allUnconfirmed = [...unconfirmedSessions, candidate];
  const mergedStart = Math.min(...allUnconfirmed.map((s) => s.startTime));
  const mergedEnd = Math.max(...allUnconfirmed.map((s) => s.endTime));
  const mergedConfidence = Math.max(...allUnconfirmed.map((s) => s.confidence));

  // Combine unique notes from all merging sessions so source-specific data
  // (e.g. exercise type) is not lost when sessions from different detection
  // sources overlap.  Step counts are stored in the `steps` column instead.
  //
  // For Health Connect steps sessions, notes are regenerated from the aggregated
  // step total and merged duration instead of concatenating the per-record
  // strings — this avoids ugly note blobs when many tiny records merge together.
  const mergedDurationMs = mergedEnd - mergedStart;

  // GPS notes are already aggregated per session (distance + speed baked in),
  // so we just deduplicate them.
  const uniqueGpsNotes = [
    ...new Set(
      allUnconfirmed.filter((s) => s.source === 'gps' && s.notes).map((s) => s.notes as string)
    ),
  ];

  // Sum step counts so the merged session reflects the total steps walked
  // across all contributing Health Connect steps records.
  const stepsTotal = allUnconfirmed.reduce((sum, s) => sum + (s.steps ?? 0), 0);
  const mergedSteps = stepsTotal > 0 ? stepsTotal : undefined;

  // Sum distances from GPS sessions.
  const distanceTotal = allUnconfirmed.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);
  const mergedDistance = distanceTotal > 0 ? distanceTotal : undefined;

  // Compute average speed from aggregated data rather than taking the max of
  // per-record speeds.  GPS speed = distance / time; HC speed = derived from
  // aggregated steps using the same 110 steps/min ≈ 5 km/h baseline used in
  // healthConnect.ts.
  let mergedSpeed: number | undefined;
  if (mergedDistance != null && mergedDurationMs > 0) {
    // km / h from metres and milliseconds
    mergedSpeed = ((mergedDistance / mergedDurationMs) * MS_PER_HOUR) / METERS_PER_KM;
  } else if (mergedSteps != null && mergedDurationMs > 0) {
    const durationMin = mergedDurationMs / 60_000;
    const stepsPerMin = mergedSteps / durationMin;
    mergedSpeed = (stepsPerMin / STEPS_PER_MIN_AT_BASELINE) * BASELINE_SPEED_KMH;
  }

  // Build HC description from aggregated steps rather than joining per-record notes.
  const hcNotesParts: string[] = [];
  if (mergedSteps != null && mergedDurationMs > 0) {
    const durationMin = mergedDurationMs / 60_000;
    const stepsPerMin = mergedSteps / durationMin;
    const speedKmh = (stepsPerMin / STEPS_PER_MIN_AT_BASELINE) * BASELINE_SPEED_KMH;
    const imperial = isImperialUnits();
    const speed = imperial ? kmhToMph(speedKmh).toFixed(1) : speedKmh.toFixed(1);
    const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');
    hcNotesParts.push(
      t('session_notes_hc_steps', {
        steps: mergedSteps.toLocaleString(t('locale_tag')),
        speed,
        speedUnit,
      })
    );
  } else {
    // HC sessions without step data (exercise-only records) — keep unique notes.
    const uniqueHcNotes = [
      ...new Set(
        allUnconfirmed
          .filter((s) => s.source === 'health_connect' && s.notes)
          .map((s) => s.notes as string)
      ),
    ];
    hcNotesParts.push(...uniqueHcNotes);
  }

  // Also carry through any non-GPS, non-HC notes (e.g. timeline) unchanged.
  const otherNotes = [
    ...new Set(
      allUnconfirmed
        .filter((s) => s.source !== 'gps' && s.source !== 'health_connect' && s.notes)
        .map((s) => s.notes as string)
    ),
  ];

  const allParts = [...uniqueGpsNotes, ...hcNotesParts, ...otherNotes];
  const mergedNotes = allParts.length > 0 ? allParts.join(' ') : undefined;

  // Preserve a denied (userConfirmed=0) status from existing unconfirmed sessions
  // so that a re-detection never silently un-denies a session.
  const deniedSession = unconfirmedSessions.find((s) => s.userConfirmed === 0);

  // Delete all existing unconfirmed sessions in the overlap window (batched).
  const idsToDelete = unconfirmedSessions.filter((s) => s.id != null).map((s) => s.id as number);
  await deleteSessionsByIdsAsync(idsToDelete);

  // Subtract confirmed session time from the merged range so that confirmed user
  // data is never overwritten.  Each remaining gap becomes an unconfirmed segment.
  const sortedConfirmed = [...confirmedSessions]
    .filter((s) => s.startTime < mergedEnd && s.endTime > mergedStart)
    .sort((a, b) => a.startTime - b.startTime);

  if (sortedConfirmed.length > 0) {
    console.log(`TouchGrass: Session split around ${sortedConfirmed.length} confirmed session(s)`);
  }

  const segments: [number, number][] = [];
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
    console.log(
      `TouchGrass: Session split result: ${segments.length} segment(s) after subtracting confirmed ranges`
    );
    segments.forEach(([s, e], idx) => {
      console.log(
        `  Segment ${idx}: ${new Date(s).toISOString()} – ${new Date(e).toISOString()} (${Math.round((e - s) / 60000)} min)`
      );
    });
  }

  // Pre-load time-slot probabilities once for all segments (hoisted read).
  const timeSlotProbs = await loadTimeSlotProbabilities();

  // Build all segment sessions in memory with scores computed synchronously.
  const sessionsToInsert: OutsideSession[] = [];
  for (const [segStart, segEnd] of segments) {
    const segSession: OutsideSession = {
      ...candidate,
      startTime: segStart,
      endTime: segEnd,
      durationMinutes: (segEnd - segStart) / 60000,
      confidence: mergedConfidence,
      userConfirmed: deniedSession ? 0 : null,
      discarded: 0,
      notes: mergedNotes,
      steps: mergedSteps,
      distanceMeters: mergedDistance,
      averageSpeedKmh: mergedSpeed,
    };
    const score = computeSessionScoreFromProbs(segSession, timeSlotProbs);
    // Only discard sessions that have no user feedback yet (userConfirmed === null).
    // Sessions the user explicitly denied (userConfirmed === 0) keep discarded=0 so
    // their rejection is preserved and visible in the Standard tab.
    const shouldDiscard = segSession.userConfirmed === null && score < DISCARD_CONFIDENCE_THRESHOLD;
    if (shouldDiscard) {
      console.log(
        `TouchGrass: Session discarded (score ${score.toFixed(2)} < threshold ${DISCARD_CONFIDENCE_THRESHOLD}): ${new Date(segStart).toISOString()} – ${new Date(segEnd).toISOString()} source=${candidate.source}`
      );
    }
    sessionsToInsert.push({
      ...segSession,
      confidence: score, // store computed score so the UI reflects actual confidence
      discarded: shouldDiscard ? 1 : 0,
    });
  }

  // Batch-insert all segments in a single transaction.
  await insertSessionsBatchAsync(sessionsToInsert);
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
  steps?: number,
  distanceMeters?: number,
  averageSpeedKmh?: number
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
    steps,
    distanceMeters,
    averageSpeedKmh,
    discarded: 0,
  };
}
