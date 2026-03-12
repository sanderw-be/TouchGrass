jest.mock('../storage/database');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');

import * as Database from '../storage/database';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import { scoreReminderHours, shouldRemindNow, HourScore } from '../notifications/reminderAlgorithm';

describe('reminderAlgorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getReminderFeedback as jest.Mock).mockReturnValue([]);
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([]);
    (Database.startOfWeek as jest.Mock).mockReturnValue(0);
    (WeatherService.getWeatherForHour as jest.Mock).mockReturnValue(null);
    (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
  });

  describe('scoreReminderHours', () => {
    it('returns 48 half-hour slot scores (7:00–22:30)', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      // Slots from 7:00 to 22:30 inclusive at 30-min intervals:
      // hours 7–22 inclusive = 16 hours × 2 slots/hour = 32 slots
      expect(scores).toHaveLength(32);
    });

    it('each score has hour, minute, score, and reason fields', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      for (const s of scores) {
        expect(s).toHaveProperty('hour');
        expect(s).toHaveProperty('minute');
        expect(s).toHaveProperty('score');
        expect(s).toHaveProperty('reason');
        expect([0, 30]).toContain(s.minute);
      }
    });

    it('minute field is 0 for :00 slots and 30 for :30 slots', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      const slot700 = scores.find((s) => s.hour === 7 && s.minute === 0);
      const slot730 = scores.find((s) => s.hour === 7 && s.minute === 30);
      expect(slot700).toBeDefined();
      expect(slot700!.minute).toBe(0);
      expect(slot730).toBeDefined();
      expect(slot730!.minute).toBe(30);
    });

    it('marks past slots with score 0 and reason "already passed"', () => {
      // currentHour=14, currentMinute=0 → slots before 14:00 are past
      const scores = scoreReminderHours(0, 30, 14, 0);
      const slot900 = scores.find((s) => s.hour === 9 && s.minute === 0);
      expect(slot900).toBeDefined();
      expect(slot900!.score).toBe(0);
      expect(slot900!.reason).toBe('already passed');
    });

    it('includes the current half-hour slot (not skipped)', () => {
      // currentHour=12, currentMinute=15 → current slot is 12:00 (minute < 30)
      // currentSlotMinutes = 12*60+15 = 735; slot 12:00 = 720 < 735 → already passed
      // slot 12:30 = 750 >= 735 → included
      const scores = scoreReminderHours(0, 30, 12, 15);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0);
      const slot1230 = scores.find((s) => s.hour === 12 && s.minute === 30);
      expect(slot1200!.score).toBe(0); // past
      expect(slot1230!.score).toBeGreaterThan(0); // future
    });

    it('returns scores sorted best first', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      const nonZero = scores.filter((s) => s.score > 0);
      for (let i = 1; i < nonZero.length; i++) {
        expect(nonZero[i - 1].score).toBeGreaterThanOrEqual(nonZero[i].score);
      }
    });

    it('gives lunch-hour slots (12 and 13) a bonus', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      const slot1800 = scores.find((s) => s.hour === 18 && s.minute === 0)!;
      // Lunch bonus adds 0.1, after-work adds 0.15; without other factors both start at 0.5
      // 12:00 should benefit from lunch +0.10
      expect(slot1200.score).toBeGreaterThan(0.5);
      expect(slot1200.reason).toContain('lunch');
    });

    it('gives after-work slots (17–19) a bonus', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      const slot1730 = scores.find((s) => s.hour === 17 && s.minute === 30)!;
      expect(slot1730.score).toBeGreaterThan(0.5);
      expect(slot1730.reason).toContain('after-work');
    });

    it('applies less_often feedback penalty only to the matching half-hour slot', () => {
      (Database.getReminderFeedback as jest.Mock).mockReturnValue([
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: Date.now() },
      ]);
      const scores = scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const slot1030 = scores.find((s) => s.hour === 10 && s.minute === 30)!;
      // Only the :00 slot should be penalised (feedback is keyed by half-hour)
      expect(slot1000.score).toBeLessThan(0.5);
      expect(slot1030.score).toBe(0.5); // unaffected baseline
    });

    it('applies more_often feedback bonus', () => {
      (Database.getReminderFeedback as jest.Mock).mockReturnValue([
        { action: 'more_often', scheduledHour: 15, scheduledMinute: 0, dayOfWeek: 1, timestamp: Date.now() },
      ]);
      const scores = scoreReminderHours(0, 30, 0, 0);
      const slot1500 = scores.find((s) => s.hour === 15 && s.minute === 0)!;
      expect(slot1500.score).toBeGreaterThan(0.5);
    });

    it('clamps scores to [0, 1]', () => {
      const scores = scoreReminderHours(0, 30, 0, 0);
      for (const s of scores) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('shouldRemindNow', () => {
    it('returns false when currently outside', () => {
      const result = shouldRemindNow(0, 30, 0, true);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('currently outside');
    });

    it('returns false when daily goal is reached', () => {
      const result = shouldRemindNow(30, 30, 0, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('daily goal reached');
    });

    it('returns false outside quiet hours (before 7am)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(5);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      const result = shouldRemindNow(0, 30, 0, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('outside quiet hours');
      jest.restoreAllMocks();
    });

    it('returns false when reminded recently (< 60 min ago)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      const recentMs = Date.now() - 30 * 60 * 1000; // 30 min ago
      const result = shouldRemindNow(0, 30, recentMs, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('reminded recently');
      jest.restoreAllMocks();
    });

    it('returns false when current slot score is too low', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      // All feedback penalises 10:00 heavily
      (Database.getReminderFeedback as jest.Mock).mockReturnValue([
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 1 },
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 2 },
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 3 },
        { action: 'dismissed', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 4 },
      ]);
      const result = shouldRemindNow(0, 30, 0, false);
      expect(result.should).toBe(false);
      jest.restoreAllMocks();
    });

    it('identifies the correct half-hour slot for a :30 minute time', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      // The current slot should be 12:30, not 12:00
      const result = shouldRemindNow(0, 30, 0, false);
      // With default baseline 0.5 and lunch bonus, score should be > 0.35
      expect(result.should).toBe(true);
      jest.restoreAllMocks();
    });
  });
});
