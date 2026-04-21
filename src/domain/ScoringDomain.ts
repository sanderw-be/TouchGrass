/**
 * Combined confidence score below this threshold causes a session to be stored
 * as `discarded = 1` rather than being proposed to the user for review.
 */
export const DISCARD_CONFIDENCE_THRESHOLD = 0.4;

/** Starting probability for a (hour, dayOfWeek) slot with no history. */
export const DEFAULT_TIME_SLOT_PROBABILITY = 0.5;

/**
 * How quickly the per-slot probability converges to confirmed/denied signal.
 * Smaller values = more gradual learning.
 */
const LEARNING_RATE = 0.1;

/**
 * Update the time-slot probability after a user confirms or denies a session.
 * Uses an exponential moving average: new = current + LEARNING_RATE × (target − current)
 */
export function calculateUpdatedProbability(currentProb: number, confirmed: boolean): number {
  const target = confirmed ? 1.0 : 0.0;
  const updated = currentProb + LEARNING_RATE * (target - currentProb);
  return Math.max(0.1, Math.min(0.9, updated));
}

/**
 * Returns a multiplier (0–1) that reflects how plausible the session duration
 * is for a genuine outdoor activity.
 */
export function scoreDuration(durationMs: number): number {
  const minutes = durationMs / 60_000;
  if (minutes <= 5) return 0.3; // too short to be meaningful
  if (minutes <= 15) return 0.7; // short but plausible
  if (minutes <= 90) return 1.0; // ideal outdoor session length
  if (minutes <= 240) return 0.8; // up to 4 h: long walk / hike, still plausible
  return 0.4; // > 4 h: unlikely to be a single outdoor session
}

/**
 * Compute an adjusted confidence score for a candidate session.
 */
export function calculateSessionScore(
  baseConfidence: number,
  durationMs: number,
  timeSlotProb: number
): number {
  const durationFactor = scoreDuration(durationMs);
  const raw = baseConfidence * durationFactor * (0.5 + timeSlotProb);
  return Math.min(1, Math.max(0, raw));
}
