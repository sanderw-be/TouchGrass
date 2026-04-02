// Mock expo-sqlite before importing database module
jest.mock('expo-sqlite');

import { getDailyStreak, getWeeklyStreak } from '../storage/database';

describe('Streak Tracking', () => {
  describe('getDailyStreak', () => {
    it('should exist and be a function', () => {
      expect(typeof getDailyStreak).toBe('function');
    });

    it('should return a number', () => {
      const streak = getDailyStreak();
      expect(typeof streak).toBe('number');
    });

    it('should return 0 or positive integer', () => {
      const streak = getDailyStreak();
      expect(streak).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(streak)).toBe(true);
    });
  });

  describe('getWeeklyStreak', () => {
    it('should exist and be a function', () => {
      expect(typeof getWeeklyStreak).toBe('function');
    });

    it('should return a number', () => {
      const streak = getWeeklyStreak();
      expect(typeof streak).toBe('number');
    });

    it('should return 0 or positive integer', () => {
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
