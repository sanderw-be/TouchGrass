import {
  OutsideSession,
  insertSessionAsync,
  insertSessionsBatchAsync,
  getSessionsForRangeAsync,
  deleteSessionsByIdsAsync,
} from '../storage';
import { computeSessionScoreFromProbs, loadTimeSlotProbabilities } from './sessionConfidence';
import { DISCARD_CONFIDENCE_THRESHOLD } from '../domain/ScoringDomain';
import {
  mergeSessionData,
  calculateMergedSpeed,
  splitRangeAroundConfirmed,
} from '../domain/SessionDomain';
import { t } from '../i18n';
import { isImperialUnits, kmhToMph } from '../utils/units';

const MERGE_GAP_MS = 5 * 60 * 1000;

export async function submitSession(candidate: OutsideSession): Promise<void> {
  if (candidate.source === 'manual') {
    await insertSessionAsync(candidate);
    return;
  }

  const windowStart = candidate.startTime - MERGE_GAP_MS;
  const windowEnd = candidate.endTime + MERGE_GAP_MS;
  const existing = await getSessionsForRangeAsync(windowStart, windowEnd);

  const confirmedSessions = existing.filter((s) => s.userConfirmed === 1);
  const unconfirmedSessions = existing.filter((s) => s.userConfirmed !== 1);

  // Use domain logic for merging
  const mergedData = mergeSessionData(candidate, unconfirmedSessions);
  const mergedDurationMs = mergedData.endTime - mergedData.startTime;

  // Aggregate stats from all unconfirmed sessions
  const allUnconfirmed = [...unconfirmedSessions, candidate];

  const stepsTotal = allUnconfirmed.reduce((sum, s) => sum + (s.steps ?? 0), 0);
  const distanceTotal = allUnconfirmed.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);

  // Use domain logic for speed calculation
  const mergedSpeed = calculateMergedSpeed(mergedDurationMs, distanceTotal, stepsTotal);

  // Note building (still somewhat integrated with i18n, but logic is consolidated)
  const uniqueGpsNotes = [
    ...new Set(
      allUnconfirmed.filter((s) => s.source === 'gps' && s.notes).map((s) => s.notes as string)
    ),
  ];

  const hcNotesParts: string[] = [];
  if (stepsTotal > 0 && mergedDurationMs > 0) {
    const durationMin = mergedDurationMs / 60_000;
    const stepsPerMin = stepsTotal / durationMin;
    const speedKmh = (stepsPerMin / 110) * 5; // Using constants directly or from domain
    const imperial = isImperialUnits();
    const speed = imperial ? kmhToMph(speedKmh).toFixed(1) : speedKmh.toFixed(1);
    const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');
    hcNotesParts.push(
      t('session_notes_hc_steps', {
        steps: stepsTotal.toLocaleString(t('locale_tag')),
        speed,
        speedUnit,
      })
    );
  } else {
    const uniqueHcNotes = [
      ...new Set(
        allUnconfirmed
          .filter((s) => s.source === 'health_connect' && s.notes)
          .map((s) => s.notes as string)
      ),
    ];
    hcNotesParts.push(...uniqueHcNotes);
  }

  const otherNotes = [
    ...new Set(
      allUnconfirmed
        .filter((s) => s.source !== 'gps' && s.source !== 'health_connect' && s.notes)
        .map((s) => s.notes as string)
    ),
  ];

  const allParts = [...uniqueGpsNotes, ...hcNotesParts, ...otherNotes];
  const mergedNotes = allParts.length > 0 ? allParts.join(' ') : undefined;

  const deniedSession = unconfirmedSessions.find((s) => s.userConfirmed === 0);

  const idsToDelete = unconfirmedSessions.filter((s) => s.id != null).map((s) => s.id as number);
  await deleteSessionsByIdsAsync(idsToDelete);

  // Use domain logic for splitting
  const segments = splitRangeAroundConfirmed(
    mergedData.startTime,
    mergedData.endTime,
    confirmedSessions
  );

  if (confirmedSessions.length > 0) {
    console.log(
      `TouchGrass: Session split around ${confirmedSessions.length} confirmed session(s)`
    );
  }

  const timeSlotProbs = await loadTimeSlotProbabilities();

  const sessionsToInsert: OutsideSession[] = [];
  for (const [segStart, segEnd] of segments) {
    const segSession: OutsideSession = {
      ...candidate,
      startTime: segStart,
      endTime: segEnd,
      durationMinutes: (segEnd - segStart) / 60000,
      confidence: mergedData.confidence,
      userConfirmed: deniedSession ? 0 : null,
      discarded: 0,
      notes: mergedNotes,
      steps: stepsTotal > 0 ? stepsTotal : undefined,
      distanceMeters: distanceTotal > 0 ? distanceTotal : undefined,
      averageSpeedKmh: mergedSpeed,
    };
    const score = computeSessionScoreFromProbs(segSession, timeSlotProbs);
    const shouldDiscard = segSession.userConfirmed === null && score < DISCARD_CONFIDENCE_THRESHOLD;

    sessionsToInsert.push({
      ...segSession,
      confidence: score,
      discarded: shouldDiscard ? 1 : 0,
    });
  }

  await insertSessionsBatchAsync(sessionsToInsert);
}

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
    userConfirmed: source === 'manual' ? 1 : null,
    notes,
    steps,
    distanceMeters,
    averageSpeedKmh,
    discarded: 0,
  };
}
