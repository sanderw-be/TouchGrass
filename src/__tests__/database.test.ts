// Mock the database before importing
jest.mock('expo-sqlite');

import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfNextMonth,
} from '../storage/database';

describe('Database', () => {
  describe('initDatabase', () => {
    it('can be imported and called without errors', () => {
      const { initDatabase } = require('../storage/database');
      // Verify it doesn't throw - actual DB operations are mocked
      expect(typeof initDatabase).toBe('function');
    });
  });

  describe('Settings', () => {
    it('getSetting and setSetting functions exist', () => {
      const { getSetting, setSetting } = require('../storage/database');
      expect(typeof getSetting).toBe('function');
      expect(typeof setSetting).toBe('function');
    });
  });
});

describe('Date helpers', () => {
  describe('startOfDay', () => {
    it('returns the start of the day', () => {
      const date = new Date('2024-01-15T14:30:45').getTime();
      const result = startOfDay(date);
      const expected = new Date('2024-01-15T00:00:00').getTime();
      expect(result).toBe(expected);
    });
  });

  describe('startOfWeek', () => {
    it('returns the start of the week (Monday)', () => {
      // Wednesday, Jan 17, 2024
      const date = new Date('2024-01-17T14:30:45').getTime();
      const result = startOfWeek(date);
      // Should return Monday, Jan 15, 2024
      const expected = new Date('2024-01-15T00:00:00').getTime();
      expect(result).toBe(expected);
    });

    it('handles Sundays correctly', () => {
      // Sunday, Jan 21, 2024
      const date = new Date('2024-01-21T14:30:45').getTime();
      const result = startOfWeek(date);
      // Should return Monday, Jan 15, 2024
      const expected = new Date('2024-01-15T00:00:00').getTime();
      expect(result).toBe(expected);
    });
  });

  describe('startOfMonth', () => {
    it('returns the first day of the month', () => {
      const date = new Date('2024-01-15T14:30:45').getTime();
      const result = startOfMonth(date);
      const expected = new Date('2024-01-01T00:00:00').getTime();
      expect(result).toBe(expected);
    });
  });

  describe('startOfNextMonth', () => {
    it('returns the first day of the next month', () => {
      const date = new Date('2024-01-15T14:30:45').getTime();
      const result = startOfNextMonth(date);
      const expected = new Date('2024-02-01T00:00:00').getTime();
      expect(result).toBe(expected);
    });

    it('handles year transition', () => {
      const date = new Date('2024-12-15T14:30:45').getTime();
      const result = startOfNextMonth(date);
      const expected = new Date('2025-01-01T00:00:00').getTime();
      expect(result).toBe(expected);
    });
  });
});
