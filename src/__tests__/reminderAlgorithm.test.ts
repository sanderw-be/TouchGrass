jest.mock('../storage');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');
jest.mock('../i18n', () => ({ t: (key: string) => key }));

import * as Database from '../storage';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import {
  scoreReminderHours,
  shouldRemindNow,
  ScoreContributor,
} from '../notifications/reminderAlgorithm';

describe('reminderAlgorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([]);
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);
    (Database.startOfWeek as jest.Mock).mockReturnValue(0);
    (WeatherService.getWeatherForHour as jest.Mock).mockResolvedValue(null);
    (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
    // Neutralise random jitter so score assertions are deterministic.
    // jitter = (Math.random() - 0.5) * 2 * MAX_JITTER → with 0.5 the jitter is exactly 0.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scoreReminderHours', () => {
    it('returns 48 half-hour slot scores (7:00–22:30)', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      // Slots from 7:00 to 22:30 inclusive at 30-min intervals:
      // hours 7–22 inclusive = 16 hours × 2 slots/hour = 32 slots
      expect(scores).toHaveLength(32);
    });

    it('each score has hour, minute, score, reason, and contributors fields', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      for (const s of scores) {
        expect(s).toHaveProperty('hour');
        expect(s).toHaveProperty('minute');
        expect(s).toHaveProperty('score');
        expect(s).toHaveProperty('reason');
        expect(s).toHaveProperty('contributors');
        expect(Array.isArray(s.contributors)).toBe(true);
        expect([0, 30]).toContain(s.minute);
      }
    });

    it('minute field is 0 for :00 slots and 30 for :30 slots', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot700 = scores.find((s) => s.hour === 7 && s.minute === 0);
      const slot730 = scores.find((s) => s.hour === 7 && s.minute === 30);
      expect(slot700).toBeDefined();
      expect(slot700!.minute).toBe(0);
      expect(slot730).toBeDefined();
      expect(slot730!.minute).toBe(30);
    });

    it('marks past slots with score 0 and reason "already passed"', async () => {
      // currentHour=14, currentMinute=0 → slots before 14:00 are past
      const scores = await scoreReminderHours(0, 30, 14, 0);
      const slot900 = scores.find((s) => s.hour === 9 && s.minute === 0);
      expect(slot900).toBeDefined();
      expect(slot900!.score).toBe(0);
      expect(slot900!.reason).toBe('already passed');
    });

    it('includes the current half-hour slot (not skipped)', async () => {
      // currentHour=12, currentMinute=15 → current slot is 12:00 (minute < 30)
      // currentSlotMinutes = 12*60+15 = 735; slot 12:00 = 720 < 735 → already passed
      // slot 12:30 = 750 >= 735 → included
      const scores = await scoreReminderHours(0, 30, 12, 15);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0);
      const slot1230 = scores.find((s) => s.hour === 12 && s.minute === 30);
      expect(slot1200!.score).toBe(0); // past
      expect(slot1230!.score).toBeGreaterThan(0); // future
    });

    it('returns scores sorted best first', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const nonZero = scores.filter((s) => s.score > 0);
      for (let i = 1; i < nonZero.length; i++) {
        expect(nonZero[i - 1].score).toBeGreaterThanOrEqual(nonZero[i].score);
      }
    });

    it('gives lunch-hour slots (12 and 13) a bonus', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      // Lunch bonus adds 0.1, after-work adds 0.15; without other factors both start at 0.5
      // 12:00 should benefit from lunch +0.10
      expect(slot1200.score).toBeGreaterThan(0.5);
      expect(slot1200.reason).toContain('lunch');
    });

    it('gives after-work slots (17–19) a bonus', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1730 = scores.find((s) => s.hour === 17 && s.minute === 30)!;
      expect(slot1730.score).toBeGreaterThan(0.5);
      expect(slot1730.reason).toContain('after-work');
    });

    it('applies less_often feedback penalty only to the matching half-hour slot', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        {
          action: 'less_often',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const slot1030 = scores.find((s) => s.hour === 10 && s.minute === 30)!;
      // Only the :00 slot should be penalised (feedback is keyed by half-hour)
      expect(slot1000.score).toBeLessThan(0.5);
      expect(slot1030.score).toBe(0.5); // unaffected baseline
    });

    it('applies bad_time feedback with a significant penalty to the matching half-hour slot', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        {
          action: 'bad_time',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const slot1030 = scores.find((s) => s.hour === 10 && s.minute === 30)!;
      // bad_time applies a 0.30 penalty — larger than less_often (0.15)
      expect(slot1000.score).toBeLessThan(0.5);
      expect(slot1000.reason).toContain('bad_time');
      // Other slots are unaffected
      expect(slot1030.score).toBe(0.5);
    });

    it('bad_time penalty is larger than less_often penalty for the same count', async () => {
      const badTimeFeedback = [
        {
          action: 'bad_time',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ];
      const lessOftenFeedback = [
        {
          action: 'less_often',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ];

      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue(badTimeFeedback);
      const scoresWithBadTime = await scoreReminderHours(0, 30, 0, 0);
      const badTimeSlot = scoresWithBadTime.find((s) => s.hour === 10 && s.minute === 0)!;

      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue(lessOftenFeedback);
      const scoresWithLessOften = await scoreReminderHours(0, 30, 0, 0);
      const lessOftenSlot = scoresWithLessOften.find((s) => s.hour === 10 && s.minute === 0)!;

      expect(badTimeSlot.score).toBeLessThan(lessOftenSlot.score);
    });

    it('applies more_often feedback bonus', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        {
          action: 'more_often',
          scheduledHour: 15,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1500 = scores.find((s) => s.hour === 15 && s.minute === 0)!;
      expect(slot1500.score).toBeGreaterThan(0.5);
    });

    it('clamps scores to [0, 1]', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      for (const s of scores) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    });

    it('applies proximity penalty to slots near a planned reminder', async () => {
      // Planned slot at 12:00 (720 min); slot at 12:30 (750 min) is 30 min away
      // multiplier = 30 / 180 ≈ 0.167; score should be (0.5 + 0.10) * 0.167 ≈ 0.10
      const planned = [{ hour: 12, minute: 0 as 0 | 30 }];
      const scores = await scoreReminderHours(0, 30, 0, 0, planned);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      const slot1230 = scores.find((s) => s.hour === 12 && s.minute === 30)!;
      const slot1800 = scores.find((s) => s.hour === 18 && s.minute === 0)!;
      // slot at the same time as the planned slot gets multiplier 0 → score 0
      expect(slot1200.score).toBe(0);
      // slot 30 min away should be penalised compared to an unplanned scenario
      expect(slot1230.score).toBeLessThan(0.5);
      expect(slot1230.reason).toContain('proximity');
      // slot 6 hours away (≥ 3 h threshold) should NOT be penalised
      expect(slot1800.score).toBeGreaterThanOrEqual(0.5);
      expect(slot1800.reason).not.toContain('proximity');
    });

    it('slots exactly 3 hours or more away are not penalised by proximity', async () => {
      // Planned at 10:00 (600 min); 13:00 (780 min) is exactly 180 min away → multiplier 1.0
      const planned = [{ hour: 10, minute: 0 as 0 | 30 }];
      const scores = await scoreReminderHours(0, 30, 0, 0, planned);
      const slot1300 = scores.find((s) => s.hour === 13 && s.minute === 0)!;
      expect(slot1300.reason).not.toContain('proximity');
    });

    it('uses the most restrictive proximity multiplier when multiple slots are planned', async () => {
      // Two planned slots at 10:00 and 16:00; slot at 13:00 is 180 min from 10:00 and
      // 180 min from 16:00 → both multipliers = 1.0, so no penalty
      const planned = [
        { hour: 10, minute: 0 as 0 | 30 },
        { hour: 16, minute: 0 as 0 | 30 },
      ];
      const scores = await scoreReminderHours(0, 30, 0, 0, planned);
      const slot1300 = scores.find((s) => s.hour === 13 && s.minute === 0)!;
      expect(slot1300.reason).not.toContain('proximity');

      // slot at 14:00 is 240 min from 10:00 (ok) but only 120 min from 16:00 → penalised
      const slot1400 = scores.find((s) => s.hour === 14 && s.minute === 0)!;
      expect(slot1400.reason).toContain('proximity');
    });

    it('adds random jitter to slot scores', async () => {
      // Mock Math.random to return two different values across the two score calls
      // so that the expected jitter difference is deterministic.
      // jitter = (randomValue - 0.5) * 2 * 0.05
      // With 0.3 → jitter = (0.3 - 0.5) * 0.10 = -0.02
      // With 0.7 → jitter = (0.7 - 0.5) * 0.10 = +0.02
      let callCount = 0;
      jest.spyOn(Math, 'random').mockImplementation(() => (callCount++ % 2 === 0 ? 0.3 : 0.7));

      const scores1 = await scoreReminderHours(0, 30, 0, 0);
      callCount = 0; // reset counter so second call mirrors first but with different random sequence
      jest.spyOn(Math, 'random').mockImplementation(() => (callCount++ % 2 === 0 ? 0.7 : 0.3));
      const scores2 = await scoreReminderHours(0, 30, 0, 0);

      const slot700a = scores1.find((s) => s.hour === 7 && s.minute === 0)!;
      const slot700b = scores2.find((s) => s.hour === 7 && s.minute === 0)!;
      expect(slot700a.score).not.toBe(slot700b.score);
    });

    it('jitter does not push scores outside [0, 1]', async () => {
      // Test with extreme jitter values: Math.random() = 0 → jitter = -0.05 (max negative)
      //                                  Math.random() = 1 → jitter = +0.05 (max positive)
      // Verify clamping holds for both extremes.
      jest.spyOn(Math, 'random').mockReturnValue(0); // max negative jitter
      const scoresLow = await scoreReminderHours(0, 30, 0, 0);
      for (const s of scoresLow) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }

      jest.spyOn(Math, 'random').mockReturnValue(1); // max positive jitter
      const scoresHigh = await scoreReminderHours(0, 30, 0, 0);
      for (const s of scoresHigh) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('ScoreContributor — structured reason data', () => {
    it('past slots have empty contributors array', async () => {
      const scores = await scoreReminderHours(0, 30, 14, 0);
      const slot900 = scores.find((s) => s.hour === 9 && s.minute === 0)!;
      expect(slot900.contributors).toEqual([]);
    });

    it('baseline slots with no bonuses have empty contributors', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      // 8:00 has no bonuses (not lunch, not after-work, no weather, no pattern)
      const slot800 = scores.find((s) => s.hour === 8 && s.minute === 0)!;
      expect(slot800.contributors).toEqual([]);
    });

    it('lunch slot has a lunch contributor', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      const lunchContributor = slot1200.contributors.find((c) => c.reason === 'lunch');
      expect(lunchContributor).toBeDefined();
      expect(lunchContributor!.score).toBeCloseTo(0.1);
      expect(lunchContributor!.description).toBe('notif_reason_lunch');
    });

    it('after-work slot has an after_work contributor', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1800 = scores.find((s) => s.hour === 18 && s.minute === 0)!;
      const afterWorkContributor = slot1800.contributors.find((c) => c.reason === 'after_work');
      expect(afterWorkContributor).toBeDefined();
      expect(afterWorkContributor!.score).toBeCloseTo(0.15);
      expect(afterWorkContributor!.description).toBe('notif_reason_after_work');
    });

    it('pattern boost creates a pattern contributor', async () => {
      (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([
        { startTime: new Date().setHours(10, 0, 0, 0) },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const patternContributor = slot1000.contributors.find((c) => c.reason === 'pattern');
      expect(patternContributor).toBeDefined();
      expect(patternContributor!.score).toBeGreaterThan(0);
      expect(patternContributor!.description).toBe('notif_reason_pattern');
    });

    it('acted feedback creates an acted contributor', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        {
          action: 'went_outside',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const actedContributor = slot1000.contributors.find((c) => c.reason === 'acted');
      expect(actedContributor).toBeDefined();
      expect(actedContributor!.description).toBe('notif_reason_acted');
    });

    it('more_often feedback creates a more_often contributor', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        {
          action: 'more_often',
          scheduledHour: 10,
          scheduledMinute: 0,
          dayOfWeek: 1,
          timestamp: Date.now(),
        },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      const moreOftenContributor = slot1000.contributors.find((c) => c.reason === 'more_often');
      expect(moreOftenContributor).toBeDefined();
      expect(moreOftenContributor!.description).toBe('notif_reason_more_often');
    });

    it('positive weather score creates a weather contributor with emoji and temperature', async () => {
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.getWeatherForHour as jest.Mock).mockResolvedValue({
        temperature: 20,
        weatherCode: 0,
        precipitationProbability: 0,
        cloudCover: 0,
        uvIndex: 2,
        windSpeed: 5,
        isDay: true,
        forecastHour: 12,
        forecastDate: 0,
        timestamp: 0,
      });
      (WeatherAlgorithm.scoreWeatherCondition as jest.Mock).mockReturnValue(0.2);
      (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('☀️');
      (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('Clear sky');

      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      const weatherContributor = slot1200.contributors.find((c) => c.reason === 'weather');
      expect(weatherContributor).toBeDefined();
      expect(weatherContributor!.score).toBeCloseTo(0.2);
      expect(weatherContributor!.description).toContain('☀️');
      expect(weatherContributor!.description).toContain('Clear sky');
      expect(weatherContributor!.description).toContain('68°F');
    });

    it('negative weather score does not create a weather contributor', async () => {
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.getWeatherForHour as jest.Mock).mockResolvedValue({
        temperature: 5,
        weatherCode: 61,
        precipitationProbability: 90,
        cloudCover: 100,
        uvIndex: 0,
        windSpeed: 20,
        isDay: true,
        forecastHour: 12,
        forecastDate: 0,
        timestamp: 0,
      });
      (WeatherAlgorithm.scoreWeatherCondition as jest.Mock).mockReturnValue(-0.3);
      (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('🌧️');
      (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('Rain');

      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      const weatherContributor = slot1200.contributors.find((c) => c.reason === 'weather');
      expect(weatherContributor).toBeUndefined();
    });

    it('contributors are sorted by descending score', async () => {
      // after-work (0.15) > lunch (0.10) for hour 13 which has lunch but not after-work
      // Set up pattern boost AND lunch for 12:00 to verify ordering
      (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([
        { startTime: new Date().setHours(12, 0, 0, 0) },
        { startTime: new Date().setHours(12, 0, 0, 0) },
        { startTime: new Date().setHours(12, 0, 0, 0) },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      // pattern boost (3 * 0.1 = 0.3 capped) should be >= lunch (0.1)
      for (let i = 1; i < slot1200.contributors.length; i++) {
        expect(slot1200.contributors[i - 1].score).toBeGreaterThanOrEqual(
          slot1200.contributors[i].score
        );
      }
    });

    it('penalties (dismissed, snoozed, less_often, bad_time) do not create contributors', async () => {
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        { action: 'dismissed', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 1 },
        { action: 'snoozed', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 2 },
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 3 },
        { action: 'bad_time', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 4 },
      ]);
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1000 = scores.find((s) => s.hour === 10 && s.minute === 0)!;
      expect(slot1000.contributors).toEqual([]);
    });

    it('each contributor has reason, score, and description fields', async () => {
      const scores = await scoreReminderHours(0, 30, 0, 0);
      const slot1200 = scores.find((s) => s.hour === 12 && s.minute === 0)!;
      for (const c of slot1200.contributors) {
        expect(c).toHaveProperty('reason');
        expect(c).toHaveProperty('score');
        expect(c).toHaveProperty('description');
        expect(typeof c.reason).toBe('string');
        expect(typeof c.score).toBe('number');
        expect(typeof c.description).toBe('string');
      }
    });
  });

  describe('shouldRemindNow', () => {
    it('returns false when currently outside', async () => {
      const result = await shouldRemindNow(0, 30, 0, true);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('currently outside');
    });

    it('returns false when daily goal is reached', async () => {
      const result = await shouldRemindNow(30, 30, 0, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('daily goal reached');
    });

    it('returns false outside quiet hours (before 7am)', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(5);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      const result = await shouldRemindNow(0, 30, 0, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('outside quiet hours');
      jest.restoreAllMocks();
    });

    it('returns false when reminded recently (< 60 min ago)', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      const recentMs = Date.now() - 30 * 60 * 1000; // 30 min ago
      const result = await shouldRemindNow(0, 30, recentMs, false);
      expect(result.should).toBe(false);
      expect(result.reason).toBe('reminded recently');
      jest.restoreAllMocks();
    });

    it('returns false when current slot score is too low', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      // All feedback penalises 10:00 heavily
      (Database.getReminderFeedbackAsync as jest.Mock).mockResolvedValue([
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 1 },
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 2 },
        { action: 'less_often', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 3 },
        { action: 'dismissed', scheduledHour: 10, scheduledMinute: 0, dayOfWeek: 1, timestamp: 4 },
      ]);
      const result = await shouldRemindNow(0, 30, 0, false);
      expect(result.should).toBe(false);
      jest.restoreAllMocks();
    });

    it('identifies the correct half-hour slot for a :30 minute time', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      // The current slot should be 12:30, not 12:00
      const result = await shouldRemindNow(0, 30, 0, false);
      // With default baseline 0.5 and lunch bonus, score should be > 0.35
      expect(result.should).toBe(true);
      jest.restoreAllMocks();
    });

    it('returns empty contributors array for all false outcomes', async () => {
      expect((await shouldRemindNow(0, 30, 0, true)).contributors).toEqual([]);
      expect((await shouldRemindNow(30, 30, 0, false)).contributors).toEqual([]);
    });

    it('returns contributors from the current slot when should is true', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      const result = await shouldRemindNow(0, 30, 0, false);
      expect(result.should).toBe(true);
      expect(Array.isArray(result.contributors)).toBe(true);
      // 12:00 has a lunch contributor
      const lunchContributor = result.contributors.find(
        (c: ScoreContributor) => c.reason === 'lunch'
      );
      expect(lunchContributor).toBeDefined();
      jest.restoreAllMocks();
    });
  });
});
