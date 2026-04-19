import { OutsideSession, getSettingAsync, setSettingAsync } from '../storage';
import {
  DISCARD_CONFIDENCE_THRESHOLD,
  DEFAULT_TIME_SLOT_PROBABILITY,
  calculateUpdatedProbability,
  calculateSessionScore,
  scoreDuration as _scoreDuration,
} from '../domain/ScoringDomain';

export { DISCARD_CONFIDENCE_THRESHOLD, DEFAULT_TIME_SLOT_PROBABILITY };

const TIME_SLOT_PROBS_KEY = 'time_slot_probabilities';

export async function loadTimeSlotProbabilities(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await getSettingAsync(TIME_SLOT_PROBS_KEY, '{}'));
  } catch {
    return {};
  }
}

function slotKey(hour: number, dayOfWeek: number): string {
  return `${hour}_${dayOfWeek}`;
}

export async function getTimeSlotProbability(hour: number, dayOfWeek: number): Promise<number> {
  const probs = await loadTimeSlotProbabilities();
  return probs[slotKey(hour, dayOfWeek)] ?? DEFAULT_TIME_SLOT_PROBABILITY;
}

export async function updateTimeSlotProbability(
  hour: number,
  dayOfWeek: number,
  confirmed: boolean
): Promise<void> {
  const probs = await loadTimeSlotProbabilities();
  const key = slotKey(hour, dayOfWeek);
  const current = probs[key] ?? DEFAULT_TIME_SLOT_PROBABILITY;

  const updated = calculateUpdatedProbability(current, confirmed);

  probs[key] = updated;
  await setSettingAsync(TIME_SLOT_PROBS_KEY, JSON.stringify(probs));
}

export function scoreDuration(durationMs: number): number {
  return _scoreDuration(durationMs);
}

export async function computeSessionScore(session: OutsideSession): Promise<number> {
  const probs = await loadTimeSlotProbabilities();
  return computeSessionScoreFromProbs(session, probs);
}

export function computeSessionScoreFromProbs(
  session: OutsideSession,
  probs: Record<string, number>
): number {
  const durationMs = session.endTime - session.startTime;
  const d = new Date(session.startTime);
  const hour = d.getHours();
  const dayOfWeek = d.getDay();

  const timeSlotProb = probs[slotKey(hour, dayOfWeek)] ?? DEFAULT_TIME_SLOT_PROBABILITY;

  return calculateSessionScore(session.confidence, durationMs, timeSlotProb);
}
