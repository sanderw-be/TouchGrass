// Mock expo-sqlite before importing database module
jest.mock('expo-sqlite');

import { getDailyStreak, getWeeklyStreak, startOfDay, startOfWeek } from '../storage/database';

describe('Streak Tracking', () => {
  let mockDb: {
    getAllSync: jest.Mock;
    runSync: jest.Mock;
    execSync: jest.Mock;
    getFirstSync: jest.Mock;
  };

  beforeAll(() => {
    const SQLite = require('expo-sqlite');
    mockDb = SQLite.openDatabaseSync.mock.results[0].value;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no goal set (getFirstSync returns undefined for goals)
    mockDb.getFirstSync.mockReturnValue(undefined);
    mockDb.getAllSync.mockReturnValue([]);
  });

  describe('getDailyStreak', () => {
    it('should exist and be a function', () => {
      expect(typeof getDailyStreak).toBe('function');
    });

    it('returns 0 when there is no daily goal', () => {
      mockDb.getFirstSync.mockReturnValue(undefined);
      expect(getDailyStreak()).toBe(0);
    });

    it('returns 0 when no approved sessions exist', () => {
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([]);
      expect(getDailyStreak()).toBe(0);
    });

    it('returns 1 when only today meets the goal', () => {
      const todayStart = startOfDay(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      // Two sessions today totalling 35 minutes
      mockDb.getAllSync.mockReturnValue([
        { startTime: todayStart + 1000, durationMinutes: 20 },
        { startTime: todayStart + 3600000, durationMinutes: 15 },
      ]);
      expect(getDailyStreak()).toBe(1);
    });

    it('returns 0 when today does not meet the goal', () => {
      const todayStart = startOfDay(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      // Only 20 minutes today — below the 30-minute goal
      mockDb.getAllSync.mockReturnValue([{ startTime: todayStart + 1000, durationMinutes: 20 }]);
      expect(getDailyStreak()).toBe(0);
    });

    it('returns the correct streak for consecutive days', () => {
      const todayStart = startOfDay(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: todayStart + 1000, durationMinutes: 30 }, // today: 30 min ✓
        { startTime: todayStart - 86400000 + 1000, durationMinutes: 30 }, // yesterday: 30 min ✓
        { startTime: todayStart - 2 * 86400000 + 1000, durationMinutes: 30 }, // 2 days ago: 30 min ✓
        // 3 days ago missing → streak ends
      ]);
      expect(getDailyStreak()).toBe(3);
    });

    it('breaks the streak when a day is skipped', () => {
      const todayStart = startOfDay(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: todayStart + 1000, durationMinutes: 30 }, // today ✓
        // yesterday missing → streak breaks after 1
        { startTime: todayStart - 2 * 86400000 + 1000, durationMinutes: 30 }, // 2 days ago (not consecutive)
      ]);
      expect(getDailyStreak()).toBe(1);
    });

    it('uses a single getAllSync call (no per-day queries)', () => {
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 30, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([]);
      getDailyStreak();
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(1);
    });

    it('returns 0 or positive integer', () => {
      const streak = getDailyStreak();
      expect(streak).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(streak)).toBe(true);
    });
  });

  describe('getWeeklyStreak', () => {
    it('should exist and be a function', () => {
      expect(typeof getWeeklyStreak).toBe('function');
    });

    it('returns 0 when there is no weekly goal', () => {
      mockDb.getFirstSync.mockReturnValue(undefined);
      expect(getWeeklyStreak()).toBe(0);
    });

    it('returns 0 when no approved sessions exist', () => {
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([]);
      expect(getWeeklyStreak()).toBe(0);
    });

    it('returns 1 when only this week meets the goal', () => {
      const thisWeekStart = startOfWeek(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: thisWeekStart + 1000, durationMinutes: 100 },
        { startTime: thisWeekStart + 86400000, durationMinutes: 60 },
      ]);
      expect(getWeeklyStreak()).toBe(1);
    });

    it('returns 0 when this week does not meet the goal', () => {
      const thisWeekStart = startOfWeek(Date.now());
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: thisWeekStart + 1000, durationMinutes: 100 }, // only 100 min < 150
      ]);
      expect(getWeeklyStreak()).toBe(0);
    });

    it('returns the correct streak for consecutive weeks', () => {
      const thisWeekStart = startOfWeek(Date.now());
      const WEEK_MS = 7 * 86400000;
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: thisWeekStart + 1000, durationMinutes: 150 }, // this week ✓
        { startTime: thisWeekStart - WEEK_MS + 1000, durationMinutes: 150 }, // last week ✓
        // 2 weeks ago missing → streak ends
      ]);
      expect(getWeeklyStreak()).toBe(2);
    });

    it('breaks the streak when a week is skipped', () => {
      const thisWeekStart = startOfWeek(Date.now());
      const WEEK_MS = 7 * 86400000;
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([
        { startTime: thisWeekStart + 1000, durationMinutes: 150 }, // this week ✓
        // last week missing → streak breaks after 1
        { startTime: thisWeekStart - 2 * WEEK_MS + 1000, durationMinutes: 150 }, // 2 weeks ago
      ]);
      expect(getWeeklyStreak()).toBe(1);
    });

    it('uses a single getAllSync call (no per-week queries)', () => {
      mockDb.getFirstSync.mockReturnValue({ targetMinutes: 150, createdAt: Date.now() });
      mockDb.getAllSync.mockReturnValue([]);
      getWeeklyStreak();
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(1);
    });

    it('returns 0 or positive integer', () => {
      const streak = getWeeklyStreak();
      expect(streak).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(streak)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should handle calls without errors', () => {
      expect(() => getDailyStreak()).not.toThrow();
      expect(() => getWeeklyStreak()).not.toThrow();
    });
  });
});
