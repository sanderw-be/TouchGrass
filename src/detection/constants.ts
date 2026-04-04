// ── Shared detection constants ────────────────────────────────────────────────

/** Minimum outdoor session duration to be considered valid (5 minutes). */
export const MIN_DURATION_MS = 5 * 60 * 1000;

// ── Health Connect step-cadence constants ─────────────────────────────────────

/**
 * Default confidence level for a recognised activity session.
 * Used when the session qualifies as a normal-pace outdoor activity.
 */
export const CONFIDENCE_ACTIVITY = 0.7;

/**
 * Average walking cadence at 5 km/h (~110 steps/min).
 * Used to estimate walk duration from step count when the recorded time window
 * is unreliably short (e.g. batch-synced records from Google Fit).
 */
export const STEPS_PER_MINUTE_AT_5KMH = 110;

/**
 * Step-rate threshold corresponding to ~2.5 km/h.
 * Below this rate the session is too slow to be real outdoor walking and is
 * discarded.
 */
export const STEPS_PER_MIN_AT_2_5KMH = Math.round(STEPS_PER_MINUTE_AT_5KMH * 0.5); // 55

/**
 * Step-rate threshold corresponding to ~4 km/h.
 * Between this and STEPS_PER_MIN_AT_2_5KMH the walk is plausible but slow;
 * a reduced confidence score is applied.
 */
export const STEPS_PER_MIN_AT_4KMH = Math.round(STEPS_PER_MINUTE_AT_5KMH * 0.8); // 88
