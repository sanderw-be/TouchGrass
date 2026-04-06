jest.mock('../storage/database');

import * as Database from '../storage/database';
import {
  DISCARD_CONFIDENCE_THRESHOLD,
  DEFAULT_TIME_SLOT_PROBABILITY,
  getTimeSlotProbability,
  updateTimeSlotProbability,
  scoreDuration,
  computeSessionScore,
} from '../detection/sessionConfidence';
import { OutsideSession } from '../storage/database';

const BASE_TIME = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z (Tuesday, hour 22 in UTC)

function makeSession(overrides: Partial<OutsideSession> = {}): OutsideSession {
  const startTime = overrides.startTime ?? BASE_TIME;
  const endTime = overrides.endTime ?? startTime + 30 * 60 * 1000;
  return {
    startTime,
    endTime,
    durationMinutes: (endTime - startTime) / 60000,
    source: 'gps',
    confidence: 0.8,
    userConfirmed: null,
    discarded: 0,
    ...overrides,
  };
}

describe('scoreDuration', () => {
  it('returns low score for sessions at or below 5 minutes', () => {
    expect(scoreDuration(5 * 60 * 1000)).toBe(0.3);
    expect(scoreDuration(3 * 60 * 1000)).toBe(0.3);
    expect(scoreDuration(0)).toBe(0.3);
  });

  it('returns moderate score for sessions between 5 and 15 minutes', () => {
    expect(scoreDuration(6 * 60 * 1000)).toBe(0.7);
    expect(scoreDuration(15 * 60 * 1000)).toBe(0.7);
  });

  it('returns full score for sessions between 15 and 90 minutes', () => {
    expect(scoreDuration(16 * 60 * 1000)).toBe(1.0);
    expect(scoreDuration(30 * 60 * 1000)).toBe(1.0);
    expect(scoreDuration(90 * 60 * 1000)).toBe(1.0);
  });

  it('returns slightly reduced score for sessions between 90 min and 4 hours', () => {
    expect(scoreDuration(91 * 60 * 1000)).toBe(0.8);
    expect(scoreDuration(180 * 60 * 1000)).toBe(0.8);
    expect(scoreDuration(240 * 60 * 1000)).toBe(0.8);
  });

  it('returns low score for sessions longer than 4 hours', () => {
    expect(scoreDuration(241 * 60 * 1000)).toBe(0.4);
    expect(scoreDuration(6 * 60 * 60 * 1000)).toBe(0.4);
  });
});

describe('getTimeSlotProbability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('{}');
  });

  it('returns the default probability when no history exists', async () => {
    await expect(getTimeSlotProbability(8, 1)).resolves.toBe(DEFAULT_TIME_SLOT_PROBABILITY);
  });

  it('returns the stored probability for a known slot', async () => {
    (Database.getSettingAsync as jest.Mock).mockResolvedValue(JSON.stringify({ '8_1': 0.7 }));
    await expect(getTimeSlotProbability(8, 1)).resolves.toBeCloseTo(0.7);
  });

  it('returns default when the stored JSON is invalid', async () => {
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('not-json');
    await expect(getTimeSlotProbability(8, 1)).resolves.toBe(DEFAULT_TIME_SLOT_PROBABILITY);
  });
});

describe('updateTimeSlotProbability', () => {
  let storedProbs: Record<string, number>;

  beforeEach(() => {
    jest.clearAllMocks();
    storedProbs = {};
    (Database.getSettingAsync as jest.Mock).mockImplementation(() =>
      Promise.resolve(JSON.stringify(storedProbs))
    );
    (Database.setSettingAsync as jest.Mock).mockImplementation((_key: string, value: string) => {
      storedProbs = JSON.parse(value);
      return Promise.resolve();
    });
  });

  it('increases probability when session is confirmed', async () => {
    await updateTimeSlotProbability(8, 1, true);
    const updated = storedProbs['8_1'];
    expect(updated).toBeGreaterThan(DEFAULT_TIME_SLOT_PROBABILITY);
  });

  it('decreases probability when session is denied', async () => {
    await updateTimeSlotProbability(8, 1, false);
    const updated = storedProbs['8_1'];
    expect(updated).toBeLessThan(DEFAULT_TIME_SLOT_PROBABILITY);
  });

  it('converges toward 0.9 after many confirmations', async () => {
    for (let i = 0; i < 50; i++) {
      await updateTimeSlotProbability(8, 1, true);
    }
    expect(storedProbs['8_1']).toBeCloseTo(0.9, 1);
  });

  it('converges toward 0.1 after many denials', async () => {
    for (let i = 0; i < 50; i++) {
      await updateTimeSlotProbability(8, 1, false);
    }
    expect(storedProbs['8_1']).toBeCloseTo(0.1, 1);
  });

  it('clamps to minimum 0.1 even after extreme denials', async () => {
    storedProbs['8_1'] = 0.1;
    await updateTimeSlotProbability(8, 1, false);
    expect(storedProbs['8_1']).toBeGreaterThanOrEqual(0.1);
  });

  it('clamps to maximum 0.9 even after extreme confirmations', async () => {
    storedProbs['8_1'] = 0.9;
    await updateTimeSlotProbability(8, 1, true);
    expect(storedProbs['8_1']).toBeLessThanOrEqual(0.9);
  });

  it('updates only the targeted slot and leaves others unchanged', async () => {
    storedProbs['10_3'] = 0.6;
    await updateTimeSlotProbability(8, 1, true);
    expect(storedProbs['10_3']).toBe(0.6);
  });
});

describe('computeSessionScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return neutral time-slot probability (0.5) by default
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('{}');
  });

  it('returns a score between 0 and 1', async () => {
    const score = await computeSessionScore(makeSession());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('short sessions (≤ 5 min) produce a score below the discard threshold', async () => {
    const session = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 1000, // exactly 5 min
      confidence: 0.8,
    });
    await expect(computeSessionScore(session)).resolves.toBeLessThan(DISCARD_CONFIDENCE_THRESHOLD);
  });

  it('very long sessions (> 4 h) with GPS confidence produce a score below the discard threshold', async () => {
    const session = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 60 * 1000, // 5 hours
      confidence: 0.8,
    });
    await expect(computeSessionScore(session)).resolves.toBeLessThan(DISCARD_CONFIDENCE_THRESHOLD);
  });

  it('a normal 30-minute GPS session passes above the discard threshold', async () => {
    const session = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
      confidence: 0.8,
    });
    await expect(computeSessionScore(session)).resolves.toBeGreaterThanOrEqual(
      DISCARD_CONFIDENCE_THRESHOLD
    );
  });

  it('a 15-minute health_connect session passes above the discard threshold', async () => {
    const session = makeSession({
      source: 'health_connect',
      startTime: BASE_TIME,
      endTime: BASE_TIME + 15 * 60 * 1000,
      confidence: 0.7,
    });
    // 0.7 * 0.70 * (0.5 + 0.5) = 0.49 → above threshold
    await expect(computeSessionScore(session)).resolves.toBeGreaterThanOrEqual(
      DISCARD_CONFIDENCE_THRESHOLD
    );
  });

  it('a high-confidence time slot boosts the score', async () => {
    const session = makeSession({ endTime: BASE_TIME + 30 * 60 * 1000, confidence: 0.8 });

    // Score with neutral probability
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('{}');
    const scoreNeutral = await computeSessionScore(session);

    // Score with a high probability for this time slot
    const hour = new Date(BASE_TIME).getHours();
    const dayOfWeek = new Date(BASE_TIME).getDay();
    (Database.getSettingAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ [`${hour}_${dayOfWeek}`]: 0.9 })
    );
    const scoreHigh = await computeSessionScore(session);

    expect(scoreHigh).toBeGreaterThan(scoreNeutral);
  });

  it('clamps the result to 1 even when all factors are at maximum', async () => {
    const hour = new Date(BASE_TIME).getHours();
    const dayOfWeek = new Date(BASE_TIME).getDay();
    (Database.getSettingAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ [`${hour}_${dayOfWeek}`]: 0.9 })
    );
    const session = makeSession({
      endTime: BASE_TIME + 30 * 60 * 1000,
      confidence: 1.0,
    });
    await expect(computeSessionScore(session)).resolves.toBeLessThanOrEqual(1);
  });
});
