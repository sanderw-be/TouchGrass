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

    it('sets PRAGMA user_version to DB_VERSION on a fresh install', () => {
      const SQLite = require('expo-sqlite');
      const mockDb = SQLite.openDatabaseSync.mock.results[0].value;

      // Simulate: user_version=0, table does not exist yet (fresh install)
      mockDb.getFirstSync
        .mockReturnValueOnce({ user_version: 0 }) // PRAGMA user_version
        .mockReturnValueOnce({ count: 0 }); // sqlite_master check

      mockDb.execSync.mockClear();

      const { initDatabase } = require('../storage/database');
      initDatabase();

      // Should stamp the current version — no ALTER TABLE calls
      const pragmaSetCall = mockDb.execSync.mock.calls.find((call: string[]) =>
        call[0].includes('PRAGMA user_version =')
      );
      expect(pragmaSetCall).toBeDefined();

      const alterTableCalls = mockDb.execSync.mock.calls.filter((call: string[]) =>
        call[0].includes('ALTER TABLE')
      );
      expect(alterTableCalls).toHaveLength(0);
    });

    it('runs all migrations and updates PRAGMA user_version when existing DB has version 0', () => {
      const SQLite = require('expo-sqlite');
      const mockDb = SQLite.openDatabaseSync.mock.results[0].value;

      // Simulate: user_version=0, table already exists (old install)
      mockDb.getFirstSync
        .mockReturnValueOnce({ user_version: 0 }) // PRAGMA user_version
        .mockReturnValueOnce({ count: 1 }); // sqlite_master check

      mockDb.execSync.mockClear();

      const { initDatabase } = require('../storage/database');
      initDatabase();

      // Only look at ALTER TABLE statements
      const alterTableCalls: string[] = mockDb.execSync.mock.calls
        .map((call: string[]) => call[0] as string)
        .filter((s: string) => s.trimStart().startsWith('ALTER TABLE'));

      // All 6 ALTER TABLE statements should have been executed
      expect(
        alterTableCalls.some((s) => s.includes('known_locations') && s.includes('status'))
      ).toBe(true);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('discarded'))
      ).toBe(true);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('steps'))
      ).toBe(true);
      expect(
        alterTableCalls.some(
          (s) => s.includes('reminder_feedback') && s.includes('scheduledMinute')
        )
      ).toBe(true);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('distanceMeters'))
      ).toBe(true);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('averageSpeedKmh'))
      ).toBe(true);

      // PRAGMA user_version should be updated
      const execCalls: string[] = mockDb.execSync.mock.calls.map(
        (call: string[]) => call[0] as string
      );
      expect(execCalls.some((s) => s.includes('PRAGMA user_version ='))).toBe(true);
    });

    it('skips migrations entirely when DB is already at the current version', () => {
      const SQLite = require('expo-sqlite');
      const mockDb = SQLite.openDatabaseSync.mock.results[0].value;

      // Simulate: user_version already at target (DB_VERSION=6), table exists
      mockDb.getFirstSync
        .mockReturnValueOnce({ user_version: 6 }) // PRAGMA user_version
        .mockReturnValueOnce({ count: 1 }); // sqlite_master check

      mockDb.execSync.mockClear();

      const { initDatabase } = require('../storage/database');
      initDatabase();

      const execCalls: string[] = mockDb.execSync.mock.calls.map(
        (call: string[]) => call[0] as string
      );

      // No ALTER TABLE or PRAGMA user_version = set calls
      expect(execCalls.some((s) => s.includes('ALTER TABLE'))).toBe(false);
      expect(execCalls.some((s) => s.includes('PRAGMA user_version ='))).toBe(false);
    });

    it('runs only missing migrations for a partially migrated DB', () => {
      const SQLite = require('expo-sqlite');
      const mockDb = SQLite.openDatabaseSync.mock.results[0].value;

      // Simulate: user_version=4, table already exists — only versions 5 and 6 need to run
      mockDb.getFirstSync
        .mockReturnValueOnce({ user_version: 4 }) // PRAGMA user_version
        .mockReturnValueOnce({ count: 1 }); // sqlite_master check

      mockDb.execSync.mockClear();

      const { initDatabase } = require('../storage/database');
      initDatabase();

      // Only look at ALTER TABLE statements
      const alterTableCalls: string[] = mockDb.execSync.mock.calls
        .map((call: string[]) => call[0] as string)
        .filter((s: string) => s.trimStart().startsWith('ALTER TABLE'));

      // Migrations for versions ≤4 must NOT run
      expect(
        alterTableCalls.some((s) => s.includes('known_locations') && s.includes('status'))
      ).toBe(false);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('discarded'))
      ).toBe(false);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('steps'))
      ).toBe(false);
      expect(
        alterTableCalls.some(
          (s) => s.includes('reminder_feedback') && s.includes('scheduledMinute')
        )
      ).toBe(false);

      // Migrations for versions 5 and 6 MUST run
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('distanceMeters'))
      ).toBe(true);
      expect(
        alterTableCalls.some((s) => s.includes('outside_sessions') && s.includes('averageSpeedKmh'))
      ).toBe(true);

      // PRAGMA user_version should be updated
      const execCalls: string[] = mockDb.execSync.mock.calls.map(
        (call: string[]) => call[0] as string
      );
      expect(execCalls.some((s) => s.includes('PRAGMA user_version ='))).toBe(true);
    });

    it('does not crash when columns already exist (upgrade from old try/catch migration code)', () => {
      const SQLite = require('expo-sqlite');
      const mockDb = SQLite.openDatabaseSync.mock.results[0].value;

      // Simulate: user_version=0 (never set), table already exists, but columns already
      // exist because the old try/catch migration code ran previously.
      mockDb.getFirstSync
        .mockReturnValueOnce({ user_version: 0 }) // PRAGMA user_version
        .mockReturnValueOnce({ count: 1 }); // sqlite_master check

      // Make every ALTER TABLE throw "duplicate column name"
      mockDb.execSync.mockImplementation((sql: string) => {
        if (sql.trimStart().startsWith('ALTER TABLE')) {
          throw new Error('ERR_INTERNAL_SQLITE_ERROR: duplicate column name');
        }
      });

      const { initDatabase } = require('../storage/database');
      // Must not throw even though every ALTER TABLE fails
      expect(() => initDatabase()).not.toThrow();

      // Restore default mock behaviour for subsequent tests
      mockDb.execSync.mockReset();
      mockDb.execSync.mockReturnValue(undefined);
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

    it('countProposedSessions returns the count of unreviewed non-discarded sessions', () => {
      const { countProposedSessions } = require('../storage/database');
      mockDb.getFirstSync.mockReturnValueOnce({ cnt: 2 });
      const result = countProposedSessions();
      expect(result).toBe(2);
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed IS NULL')
      );
    });

    it('countProposedSessions returns 0 when no proposed sessions exist', () => {
      const { countProposedSessions } = require('../storage/database');
      mockDb.getFirstSync.mockReturnValueOnce(null);
      const result = countProposedSessions();
      expect(result).toBe(0);
    });

    it('autoCloseOldProposedSessions marks old proposed sessions as rejected', () => {
      const { autoCloseOldProposedSessions } = require('../storage/database');
      mockDb.runSync.mockReturnValueOnce({ changes: 3 });
      const result = autoCloseOldProposedSessions();
      expect(result).toBe(3);
      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('userConfirmed = 0'),
        expect.any(Array)
      );
    });

    it('autoCloseOldProposedSessions uses 7-day default cutoff', () => {
      const { autoCloseOldProposedSessions } = require('../storage/database');
      const before = Date.now();
      mockDb.runSync.mockReturnValueOnce({ changes: 0 });
      autoCloseOldProposedSessions();
      const after = Date.now();
      const callArgs = mockDb.runSync.mock.calls[mockDb.runSync.mock.calls.length - 1];
      const cutoff = callArgs[1][0] as number;
      // cutoff should be approximately 7 days ago
      expect(cutoff).toBeGreaterThanOrEqual(before - 7 * 24 * 60 * 60 * 1000 - 100);
      expect(cutoff).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000 + 100);
    });
  });
});

describe('Background task logs', () => {
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

  it('insertBackgroundLog and getBackgroundLogs functions exist', () => {
    const { insertBackgroundLog, getBackgroundLogs } = require('../storage/database');
    expect(typeof insertBackgroundLog).toBe('function');
    expect(typeof getBackgroundLogs).toBe('function');
  });

  it('insertBackgroundLog calls runSync to insert a row', () => {
    const { insertBackgroundLog } = require('../storage/database');
    mockDb.runSync.mockClear();
    insertBackgroundLog('gps', 'Outside (no known location)');
    // First call: INSERT, second call: DELETE prune
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO background_task_logs'),
      expect.arrayContaining(['gps', 'Outside (no known location)'])
    );
  });

  it('getBackgroundLogs with category calls getAllSync with category filter', () => {
    const { getBackgroundLogs } = require('../storage/database');
    const fakeLogs = [{ id: 1, timestamp: Date.now(), category: 'gps', message: 'test' }];
    mockDb.getAllSync.mockReturnValueOnce(fakeLogs);
    const result = getBackgroundLogs('gps');
    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category = ?'),
      expect.arrayContaining(['gps'])
    );
    expect(result).toEqual(fakeLogs);
  });

  it('getBackgroundLogs without category calls getAllSync without category filter', () => {
    const { getBackgroundLogs } = require('../storage/database');
    const fakeLogs = [
      { id: 2, timestamp: Date.now(), category: 'reminder', message: 'Daily plan: 13:00' },
    ];
    mockDb.getAllSync.mockReturnValueOnce(fakeLogs);
    const result = getBackgroundLogs();
    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.not.stringContaining('WHERE category'),
      expect.any(Array)
    );
    expect(result).toEqual(fakeLogs);
  });

  it('getBackgroundLogs returns empty array on error', () => {
    const { getBackgroundLogs } = require('../storage/database');
    mockDb.getAllSync.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    const result = getBackgroundLogs('gps');
    expect(result).toEqual([]);
  });

  it('insertBackgroundLog does not throw on error', () => {
    const { insertBackgroundLog } = require('../storage/database');
    mockDb.runSync.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    expect(() => insertBackgroundLog('health_connect', 'test')).not.toThrow();
  });
});
