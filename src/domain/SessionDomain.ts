import { OutsideSession } from '../storage/types';

export interface MergedSessionData {
  startTime: number;
  endTime: number;
  confidence: number;
  steps?: number;
  distanceMeters?: number;
  averageSpeedKmh?: number;
  notes?: string;
}

/**
 * Merge a candidate session with a set of existing overlapping unconfirmed sessions.
 * Returns the combined time range and aggregated data.
 */
export function mergeSessionData(
  candidate: OutsideSession,
  unconfirmedSessions: OutsideSession[]
): MergedSessionData {
  const all = [...unconfirmedSessions, candidate];
  const startTime = Math.min(...all.map((s) => s.startTime));
  const endTime = Math.max(...all.map((s) => s.endTime));
  const confidence = Math.max(...all.map((s) => s.confidence));

  const stepsTotal = all.reduce((sum, s) => sum + (s.steps ?? 0), 0);
  const distanceTotal = all.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);

  return {
    startTime,
    endTime,
    confidence,
    steps: stepsTotal > 0 ? stepsTotal : undefined,
    distanceMeters: distanceTotal > 0 ? distanceTotal : undefined,
    // Note: Average speed and notes are complex and source-dependent,
    // handled by specific note/stat builders.
  };
}

/**
 * Calculates the average speed for a merged session based on total distance or steps.
 */
export function calculateMergedSpeed(
  durationMs: number,
  distanceMeters?: number,
  steps?: number,
  stepsPerMinBaseline = 110,
  speedBaselineKmh = 5
): number | undefined {
  if (durationMs <= 0) return undefined;

  if (distanceMeters != null && distanceMeters > 0) {
    return ((distanceMeters / durationMs) * 3_600_000) / 1_000;
  }

  if (steps != null && steps > 0) {
    const durationMin = durationMs / 60_000;
    const stepsPerMin = steps / durationMin;
    return (stepsPerMin / stepsPerMinBaseline) * speedBaselineKmh;
  }

  return undefined;
}

/**
 * Split a time range [start, end] into segments by subtracting confirmed session ranges.
 */
export function splitRangeAroundConfirmed(
  rangeStart: number,
  rangeEnd: number,
  confirmedSessions: OutsideSession[]
): [number, number][] {
  const sortedConfirmed = [...confirmedSessions]
    .filter((s) => s.startTime < rangeEnd && s.endTime > rangeStart)
    .sort((a, b) => a.startTime - b.startTime);

  const segments: [number, number][] = [];
  let cursor = rangeStart;

  for (const confirmed of sortedConfirmed) {
    if (confirmed.startTime > cursor) {
      segments.push([cursor, confirmed.startTime]);
    }
    cursor = Math.max(cursor, confirmed.endTime);
  }

  if (cursor < rangeEnd) {
    segments.push([cursor, rangeEnd]);
  }

  return segments;
}
