// Mock the database before importing
jest.mock('expo-sqlite');

import { startOfDay, startOfWeek, startOfMonth, startOfNextMonth } from '../storage';

describe('Database', () => {
  describe('Settings', () => {
    it('getSettingAsync and setSettingAsync functions exist', () => {
      const { getSettingAsync, setSettingAsync } = require('../storage');
      expect(typeof getSettingAsync).toBe('function');
      expect(typeof setSettingAsync).toBe('function');
    });
  });

  describe('Scheduled Notifications', () => {
    it('getScheduledNotificationsAsync function exists', () => {
      const { getScheduledNotificationsAsync } = require('../storage');
      expect(typeof getScheduledNotificationsAsync).toBe('function');
    });

    it('insertScheduledNotificationAsync function exists', () => {
      const { insertScheduledNotificationAsync } = require('../storage');
      expect(typeof insertScheduledNotificationAsync).toBe('function');
    });

    it('updateScheduledNotificationAsync function exists', () => {
      const { updateScheduledNotificationAsync } = require('../storage');
      expect(typeof updateScheduledNotificationAsync).toBe('function');
    });

    it('deleteScheduledNotificationAsync function exists', () => {
      const { deleteScheduledNotificationAsync } = require('../storage');
      expect(typeof deleteScheduledNotificationAsync).toBe('function');
    });

    it('toggleScheduledNotificationAsync function exists', () => {
      const { toggleScheduledNotificationAsync } = require('../storage');
      expect(typeof toggleScheduledNotificationAsync).toBe('function');
    });
  });

  describe('Sessions', () => {
    it('updateSessionTimesAsync function exists', () => {
      const { updateSessionTimesAsync } = require('../storage');
      expect(typeof updateSessionTimesAsync).toBe('function');
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

describe('Async database functions', () => {
  let mockDb: {
    getAllSync: jest.Mock;
    runSync: jest.Mock;
    execSync: jest.Mock;
    getFirstSync: jest.Mock;
    getAllAsync: jest.Mock;
    runAsync: jest.Mock;
    getFirstAsync: jest.Mock;
  };

  beforeAll(() => {
    const SQLite = require('expo-sqlite');
    mockDb = SQLite.openDatabaseSync.mock.results[0].value;
  });

  beforeEach(() => {
    mockDb.getAllAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getFirstAsync.mockClear();
  });

  it('exports all async function variants', () => {
    const db = require('../storage');
    expect(typeof db.insertSessionAsync).toBe('function');
    expect(typeof db.getSessionsForDayAsync).toBe('function');
    expect(typeof db.getSessionsForRangeAsync).toBe('function');
    expect(typeof db.deleteSessionAsync).toBe('function');
    expect(typeof db.getTodayMinutesAsync).toBe('function');
    expect(typeof db.getWeekMinutesAsync).toBe('function');
    expect(typeof db.getDailyTotalsForMonthAsync).toBe('function');
    expect(typeof db.confirmSessionAsync).toBe('function');
    expect(typeof db.getUnreviewedSessionsAsync).toBe('function');
    expect(typeof db.getApprovedSessionsAsync).toBe('function');
    expect(typeof db.getStandardSessionsAsync).toBe('function');
    expect(typeof db.getAllSessionsIncludingDiscardedAsync).toBe('function');
    expect(typeof db.countProposedSessionsAsync).toBe('function');
    expect(typeof db.autoCloseOldProposedSessionsAsync).toBe('function');
    expect(typeof db.unDiscardSessionAsync).toBe('function');
    expect(typeof db.updateSessionTimesAsync).toBe('function');
    expect(typeof db.getCurrentDailyGoalAsync).toBe('function');
    expect(typeof db.getCurrentWeeklyGoalAsync).toBe('function');
    expect(typeof db.setDailyGoalAsync).toBe('function');
    expect(typeof db.setWeeklyGoalAsync).toBe('function');
    expect(typeof db.getDailyStreakAsync).toBe('function');
    expect(typeof db.getWeeklyStreakAsync).toBe('function');
    expect(typeof db.getKnownLocationsAsync).toBe('function');
    expect(typeof db.getAllKnownLocationsAsync).toBe('function');
    expect(typeof db.upsertKnownLocationAsync).toBe('function');
    expect(typeof db.deleteKnownLocationAsync).toBe('function');
    expect(typeof db.denyKnownLocationAsync).toBe('function');
    expect(typeof db.getSuggestedLocationsAsync).toBe('function');
    expect(typeof db.getSettingAsync).toBe('function');
    expect(typeof db.setSettingAsync).toBe('function');
    expect(typeof db.clearAllDataAsync).toBe('function');
    expect(typeof db.getScheduledNotificationsAsync).toBe('function');
    expect(typeof db.insertScheduledNotificationAsync).toBe('function');
    expect(typeof db.deleteScheduledNotificationAsync).toBe('function');
    expect(typeof db.updateScheduledNotificationAsync).toBe('function');
    expect(typeof db.toggleScheduledNotificationAsync).toBe('function');
    expect(typeof db.getBackgroundLogsAsync).toBe('function');
  });

  it('getTodayMinutesAsync uses getFirstAsync', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 42 });
    const { getTodayMinutesAsync } = require('../storage');
    const result = await getTodayMinutesAsync();
    expect(result).toBe(42);
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('userConfirmed = 1'),
      expect.any(Array)
    );
  });

  it('getSessionsForDayAsync uses getAllAsync', async () => {
    const fakeSessions = [{ id: 1, startTime: Date.now() }];
    mockDb.getAllAsync.mockResolvedValueOnce(fakeSessions);
    const { getSessionsForDayAsync } = require('../storage');
    const result = await getSessionsForDayAsync(Date.now());
    expect(result).toEqual(fakeSessions);
    expect(mockDb.getAllAsync).toHaveBeenCalled();
  });

  it('confirmSessionAsync uses runAsync', async () => {
    mockDb.runAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });
    const { confirmSessionAsync } = require('../storage');
    await confirmSessionAsync(1, true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE outside_sessions'),
      [1, 1]
    );
  });

  it('getTodayMinutesAsync returns 0 on error', async () => {
    mockDb.getFirstAsync.mockRejectedValueOnce(new Error('DB error'));
    const { getTodayMinutesAsync } = require('../storage');
    const result = await getTodayMinutesAsync();
    expect(result).toBe(0);
  });

  it('getSessionsForDayAsync returns [] on error', async () => {
    mockDb.getAllAsync.mockRejectedValueOnce(new Error('DB error'));
    const { getSessionsForDayAsync } = require('../storage');
    const result = await getSessionsForDayAsync(Date.now());
    expect(result).toEqual([]);
  });

  it('getSettingAsync uses getFirstAsync', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ value: 'test_value' });
    const { getSettingAsync } = require('../storage');
    const result = await getSettingAsync('key', 'fallback');
    expect(result).toBe('test_value');
  });

  it('setSettingAsync uses runAsync', async () => {
    mockDb.runAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });
    const { setSettingAsync } = require('../storage');
    await setSettingAsync('key', 'value');
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE'), [
      'key',
      'value',
    ]);
  });

  it('getBackgroundLogsAsync uses getAllAsync', async () => {
    const fakeLogs = [{ id: 1, timestamp: Date.now(), category: 'gps', message: 'test' }];
    mockDb.getAllAsync.mockResolvedValueOnce(fakeLogs);
    const { getBackgroundLogsAsync } = require('../storage');
    const result = await getBackgroundLogsAsync('gps');
    expect(result).toEqual(fakeLogs);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category = ?'),
      expect.arrayContaining(['gps'])
    );
  });
});
