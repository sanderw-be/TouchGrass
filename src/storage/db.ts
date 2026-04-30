import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('touchgrass.db');
db.execSync('PRAGMA journal_mode = WAL;');

/** 7 days in milliseconds — used as the default auto-close age for unreviewed sessions. */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Target schema version. Increment this whenever a new ALTER TABLE migration is added.
 */
const DB_VERSION = 6;

let initPromise: Promise<void> | null = null;

export function initDatabaseAsync(): Promise<void> {
  if (!initPromise) {
    initPromise = performInitialization();
  }
  return initPromise;
}

async function performInitialization(): Promise<void> {
  const currentVersion =
    (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  const tableAlreadyExists =
    ((
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='outside_sessions'"
      )
    )?.count ?? 0) > 0;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS outside_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      durationMinutes REAL NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.8,
      userConfirmed INTEGER,
      notes TEXT,
      discarded INTEGER NOT NULL DEFAULT 0,
      steps INTEGER,
      distanceMeters REAL,
      averageSpeedKmh REAL
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      targetMinutes INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      targetMinutes INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      action TEXT NOT NULL,
      scheduledHour INTEGER NOT NULL,
      scheduledMinute INTEGER NOT NULL DEFAULT 0,
      dayOfWeek INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS known_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radiusMeters REAL NOT NULL DEFAULT 100,
      isIndoor INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      forecastHour INTEGER NOT NULL,
      forecastDate INTEGER NOT NULL,
      temperature REAL NOT NULL,
      precipitationProbability REAL NOT NULL,
      cloudCover REAL NOT NULL,
      uvIndex REAL NOT NULL,
      windSpeed REAL NOT NULL,
      weatherCode INTEGER NOT NULL,
      isDay INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      id INTEGER PRIMARY KEY,
      fetchedAt INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      daysOfWeek TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      label TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS background_task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL
    );
  `);

  // Seed default goals if none exist
  const goalCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_goals'
  );
  if (goalCount?.count === 0) {
    await db.runAsync('INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)', [
      30,
      Date.now(),
    ]);
    await db.runAsync('INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)', [
      150,
      Date.now(),
    ]);
  }

  // Seed default settings
  await db.runAsync(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('smart_reminders_count', '0'), ('weather_enabled', '0')"
  );

  // Clean up any corrupted scheduled notifications (one-time maintenance task)
  try {
    await db.runAsync(
      `DELETE FROM scheduled_notifications 
       WHERE daysOfWeek = '' 
          OR daysOfWeek IS NULL 
          OR length(trim(daysOfWeek)) = 0`
    );
  } catch (error) {
    console.error('Error cleaning up scheduled notifications:', error);
  }

  if (!tableAlreadyExists) {
    await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
  } else if (currentVersion < DB_VERSION) {
    if (currentVersion < 1) {
      try {
        await db.execAsync(
          `ALTER TABLE known_locations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`
        );
      } catch {
        /* ignore */
      }
    }
    if (currentVersion < 2) {
      try {
        await db.execAsync(
          `ALTER TABLE outside_sessions ADD COLUMN discarded INTEGER NOT NULL DEFAULT 0`
        );
      } catch {
        /* ignore */
      }
    }
    if (currentVersion < 3) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN steps INTEGER`);
      } catch {
        /* ignore */
      }
    }
    if (currentVersion < 4) {
      try {
        await db.execAsync(
          `ALTER TABLE reminder_feedback ADD COLUMN scheduledMinute INTEGER NOT NULL DEFAULT 0`
        );
      } catch {
        /* ignore */
      }
    }
    if (currentVersion < 5) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN distanceMeters REAL`);
      } catch {
        /* ignore */
      }
    }
    if (currentVersion < 6) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN averageSpeedKmh REAL`);
      } catch {
        /* ignore */
      }
    }
    await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
    console.log(`Database migrated from version ${currentVersion} to ${DB_VERSION}`);
  }
}

// ── Clear all data ────────────────────────────────────────

export async function clearAllDataAsync(): Promise<void> {
  console.log('[Database] Clearing all data...');

  // Delete all sessions
  await db.runAsync('DELETE FROM outside_sessions');

  // Delete reminder feedback
  await db.runAsync('DELETE FROM reminder_feedback');

  // Delete background task logs
  await db.runAsync('DELETE FROM background_task_logs');

  // Reset goals to defaults
  await db.runAsync('DELETE FROM daily_goals');
  await db.runAsync('DELETE FROM weekly_goals');
  await db.runAsync('INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)', [
    30,
    Date.now(),
  ]);
  await db.runAsync('INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)', [
    150,
    Date.now(),
  ]);

  // Clear non-essential settings (keep language only; hasCompletedIntro is reset so tutorial shows again)
  await db.runAsync('DELETE FROM app_settings WHERE key NOT IN (?)', ['language']);

  console.log('[Database] All data cleared successfully');
}
