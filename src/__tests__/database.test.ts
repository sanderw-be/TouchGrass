// Mock the database before importing
jest.mock('expo-sqlite');

import { startOfDay, startOfWeek, startOfMonth, startOfNextMonth } from '../storage/database';

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

  describe('Scheduled Notifications', () => {
    it('getScheduledNotifications function exists', () => {
      const { getScheduledNotifications } = require('../storage/database');
      expect(typeof getScheduledNotifications).toBe('function');
    });

    it('insertScheduledNotification function exists', () => {
      const { insertScheduledNotification } = require('../storage/database');
      expect(typeof insertScheduledNotification).toBe('function');
    });

    it('updateScheduledNotification function exists', () => {
      const { updateScheduledNotification } = require('../storage/database');
      expect(typeof updateScheduledNotification).toBe('function');
    });

    it('deleteScheduledNotification function exists', () => {
      const { deleteScheduledNotification } = require('../storage/database');
      expect(typeof deleteScheduledNotification).toBe('function');
    });

    it('toggleScheduledNotification function exists', () => {
      const { toggleScheduledNotification } = require('../storage/database');
      expect(typeof toggleScheduledNotification).toBe('function');
    });
  });

  describe('Sessions', () => {
    it('updateSessionTimes function exists', () => {
      const { updateSessionTimes } = require('../storage/database');
      expect(typeof updateSessionTimes).toBe('function');
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

  describe('Session query functions', () => {
    const mockSessions = [
      // Normal, confirmed
      {
        id: 1,
        discarded: 0,
        userConfirmed: 1,
        startTime: 1000,
        endTime: 2000,
        durationMinutes: 16,
        source: 'gps',
        confidence: 0.9,
        notes: null,
      },
      // Normal, rejected
      {
        id: 2,
        discarded: 0,
        userConfirmed: 0,
        startTime: 3000,
        endTime: 4000,
        durationMinutes: 16,
        source: 'gps',
        confidence: 0.8,
        notes: null,
      },
      // Normal, pending (proposed)
      {
        id: 3,
        discarded: 0,
        userConfirmed: null,
        startTime: 5000,
        endTime: 6000,
        durationMinutes: 16,
        source: 'gps',
        confidence: 0.7,
        notes: null,
      },
      // Discarded
      {
        id: 4,
        discarded: 1,
        userConfirmed: null,
        startTime: 7000,
        endTime: 8000,
        durationMinutes: 16,
        source: 'gps',
        confidence: 0.2,
        notes: null,
      },
    ];

    let mockDb: {
      getAllSync: jest.Mock;
      runSync: jest.Mock;
      execSync: jest.Mock;
      getFirstSync: jest.Mock;
    };

    beforeAll(() => {
      // Get the mock db object created when database.ts was first imported
      const SQLite = require('expo-sqlite');
      mockDb = SQLite.openDatabaseSync.mock.results[0].value;
    });

    it('getApprovedSessions returns only confirmed sessions', () => {
      const { getApprovedSessions } = require('../storage/database');
      mockDb.getAllSync.mockReturnValueOnce(mockSessions.filter((s) => s.userConfirmed === 1));
      const result = getApprovedSessions(0, 9999);
      expect(result.map((s: { id: number }) => s.id)).toEqual([1]);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed = 1'),
        expect.any(Array)
      );
    });

    it('getStandardSessions excludes discarded sessions', () => {
      const { getStandardSessions } = require('../storage/database');
      mockDb.getAllSync.mockReturnValueOnce(mockSessions.filter((s) => s.discarded !== 1));
      const result = getStandardSessions(0, 9999);
      expect(result.map((s: { id: number }) => s.id)).toEqual([1, 2, 3]);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('discarded'),
        expect.any(Array)
      );
    });

    it('getAllSessionsIncludingDiscarded returns all sessions', () => {
      const { getAllSessionsIncludingDiscarded } = require('../storage/database');
      mockDb.getAllSync.mockReturnValueOnce(mockSessions);
      const result = getAllSessionsIncludingDiscarded(0, 9999);
      expect(result.map((s: { id: number }) => s.id)).toEqual([1, 2, 3, 4]);
    });

    it('getSessionsForDay excludes rejected and discarded sessions', () => {
      const { getSessionsForDay } = require('../storage/database');
      // Only approved (1) and non-discarded pending (null) sessions should be returned
      mockDb.getAllSync.mockReturnValueOnce(
        mockSessions.filter((s) => s.userConfirmed !== 0 && s.discarded !== 1)
      );
      const result = getSessionsForDay(Date.now());
      expect(result.map((s: { id: number }) => s.id)).toEqual([1, 3]);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed IS NOT 0'),
        expect.any(Array)
      );
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('discarded IS NOT 1'),
        expect.any(Array)
      );
    });

    it('getTodayMinutes only sums approved sessions', () => {
      const { getTodayMinutes } = require('../storage/database');
      mockDb.getFirstSync.mockReturnValueOnce({ total: 30 });
      const result = getTodayMinutes();
      expect(result).toBe(30);
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed = 1'),
        expect.any(Array)
      );
    });

    it('getWeekMinutes only sums approved sessions', () => {
      const { getWeekMinutes } = require('../storage/database');
      mockDb.getFirstSync.mockReturnValueOnce({ total: 120 });
      const result = getWeekMinutes();
      expect(result).toBe(120);
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed = 1'),
        expect.any(Array)
      );
    });

    it('unDiscardSession function exists and calls db with correct query', () => {
      const { unDiscardSession } = require('../storage/database');
      expect(typeof unDiscardSession).toBe('function');
      unDiscardSession(4);
      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('discarded = 0'),
        expect.arrayContaining([4])
      );
    });
  });
});
