import { OutsideSession, getSettingAsync, setSettingAsync } from '../storage/database';

/**
 * Combined confidence score below this threshold causes a session to be stored
 * as `discarded = 1` rather than being proposed to the user for review.
 */
export const DISCARD_CONFIDENCE_THRESHOLD = 0.4;

// ── Time-slot probability ─────────────────────────────────

const TIME_SLOT_PROBS_KEY = 'time_slot_probabilities';

/** Starting probability for a (hour, dayOfWeek) slot with no history. */
export const DEFAULT_TIME_SLOT_PROBABILITY = 0.5;

/**
 * How quickly the per-slot probability converges to confirmed/denied signal.
 * Smaller values = more gradual learning.
 */
const LEARNING_RATE = 0.1;

async function loadTimeSlotProbabilities(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await getSettingAsync(TIME_SLOT_PROBS_KEY, '{}'));
  } catch {
    return {};
  }
}

function slotKey(hour: number, dayOfWeek: number): string {
  return `${hour}_${dayOfWeek}`;
}

/**
 * Returns the learned probability of a session being a genuine outdoor session
 * for the given hour (0-23) and day of week (0=Sunday … 6=Saturday).
 * Starts at DEFAULT_TIME_SLOT_PROBABILITY (0.5) and converges toward 1 or 0
 * as the user confirms or denies sessions at that time slot.
 */
export async function getTimeSlotProbability(hour: number, dayOfWeek: number): Promise<number> {
  const probs = await loadTimeSlotProbabilities();
  return probs[slotKey(hour, dayOfWeek)] ?? DEFAULT_TIME_SLOT_PROBABILITY;
}

/**
 * Update the time-slot probability after a user confirms or denies a session.
 *
 * Uses an exponential moving average:
 *   new = current + LEARNING_RATE × (target − current)
 *
 * where `target` is 1.0 on confirm and 0.0 on deny.
 * Values are clamped to [0.1, 0.9] so the prior never becomes absolute.
 */
export async function updateTimeSlotProbability(
  hour: number,
  dayOfWeek: number,
  confirmed: boolean
): Promise<void> {
  const probs = await loadTimeSlotProbabilities();
  const key = slotKey(hour, dayOfWeek);
  const current = probs[key] ?? DEFAULT_TIME_SLOT_PROBABILITY;
  const target = confirmed ? 1.0 : 0.0;
  const updated = current + LEARNING_RATE * (target - current);
  probs[key] = Math.max(0.1, Math.min(0.9, updated));
  await setSettingAsync(TIME_SLOT_PROBS_KEY, JSON.stringify(probs));
}

// ── Duration scoring ──────────────────────────────────────

/**
 * Returns a multiplier (0–1) that reflects how plausible the session duration
 * is for a genuine outdoor activity.
 *
 * Ideal range: 15–90 minutes (score 1.0).
 * Short sessions (≤ 5 min) and very long sessions (> 4 h) receive low scores.
 */
export function scoreDuration(durationMs: number): number {
  const minutes = durationMs / 60_000;
  if (minutes <= 5) return 0.3; // too short to be meaningful
  if (minutes <= 15) return 0.7; // short but plausible
  if (minutes <= 90) return 1.0; // ideal outdoor session length
  if (minutes <= 240) return 0.8; // up to 4 h: long walk / hike, still plausible
  return 0.4; // > 4 h: unlikely to be a single outdoor session
}

// ── Combined confidence score ─────────────────────────────

/**
 * Compute an adjusted confidence score for a candidate session.
 *
 * The score is the product of three independent factors:
 *   • Detection confidence  – how reliable the detection method is
 *   • Duration factor       – whether the session length is plausible
 *   • Time-slot factor      – learned prior for this hour × day-of-week
 *
 * Formula:
 *   score = detection_confidence × duration_factor × (0.5 + time_slot_probability)
 *
 * The `(0.5 + time_slot_probability)` term keeps the factor centred at 1.0
 * when the probability is neutral (0.5), scales it up to 1.4 for highly
 * confirmed slots, and down to 0.6 for frequently denied slots.
 *
 * The result is clamped to [0, 1].
 */
export async function computeSessionScore(session: OutsideSession): Promise<number> {
  const durationMs = session.endTime - session.startTime;
  const d = new Date(session.startTime);
  const hour = d.getHours();
  const dayOfWeek = d.getDay(); // 0 = Sunday

  const durationFactor = scoreDuration(durationMs);
  const timeSlotProb = await getTimeSlotProbability(hour, dayOfWeek);

  const raw = session.confidence * durationFactor * (0.5 + timeSlotProb);
  return Math.min(1, Math.max(0, raw));
}
