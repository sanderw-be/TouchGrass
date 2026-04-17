import * as SQLite from 'expo-sqlite';
import { WeatherCondition, WeatherCache } from '../weather/types';

const db = SQLite.openDatabaseSync('touchgrass.db');
db.execSync('PRAGMA journal_mode = WAL;');

/** 7 days in milliseconds — used as the default auto-close age for unreviewed sessions. */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Target schema version. Increment this whenever a new ALTER TABLE migration is added.
 * Version history:
 *   1 – known_locations.status column
 *   2 – outside_sessions.discarded column
 *   3 – outside_sessions.steps column
 *   4 – reminder_feedback.scheduledMinute column
 *   5 – outside_sessions.distanceMeters column
 *   6 – outside_sessions.averageSpeedKmh column
 */
const DB_VERSION = 6;

export interface OutsideSession {
  id?: number;
  startTime: number; // unix timestamp ms
  endTime: number; // unix timestamp ms
  durationMinutes: number;
  source: 'health_connect' | 'gps' | 'manual' | 'timeline';
  confidence: number; // 0-1, how sure are we this was outside?
  userConfirmed: number | null; // 0, 1, or null — SQLite has no boolean, null = not reviewed, true/false = user feedback
  notes?: string;
  steps?: number; // aggregated step count from Health Connect steps records
  distanceMeters?: number; // total GPS distance travelled in metres
  averageSpeedKmh?: number; // average speed during the session in km/h
  discarded: number; // 1 = algorithmically discarded (too unreliable to propose), 0 = normal session
}

export interface DailyGoal {
  id?: number;
  targetMinutes: number;
  createdAt: number;
}

export interface WeeklyGoal {
  id?: number;
  targetMinutes: number;
  createdAt: number;
}

export interface ReminderFeedback {
  id?: number;
  timestamp: number;
  action: 'snoozed' | 'dismissed' | 'went_outside' | 'less_often' | 'more_often' | 'bad_time';
  scheduledHour: number; // 0-23, what hour the reminder fired
  scheduledMinute: number; // 0 or 30, which half-hour slot the reminder fired in
  dayOfWeek: number; // 0-6
}

export interface KnownLocation {
  id?: number;
  label: string; // 'home', 'work', or custom
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isIndoor: boolean;
  status: 'active' | 'suggested'; // 'suggested' = pending user approval
}

export interface ScheduledNotification {
  id?: number;
  hour: number; // 0-23
  minute: number; // 0-59
  daysOfWeek: number[]; // 0-6, Sunday=0
  enabled: number; // 0 or 1 (SQLite boolean)
  label: string; // optional label like "Morning walk"
}

export async function initDatabaseAsync(): Promise<void> {
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

  // Seed default settings that must be readable by the background task before
  // the user ever opens the app. OR IGNORE ensures existing user preferences
  // are never overwritten.
  await db.runAsync(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('smart_reminders_count', '0'), ('weather_enabled', '0')"
  );

  // Clean up any corrupted scheduled notifications (one-time maintenance task)
  try {
    const deletedCount = await cleanupInvalidScheduledNotificationsAsync();
    if (deletedCount > 0) {
      console.log(
        `Database migration: Removed ${deletedCount} corrupted scheduled notification(s)`
      );
    }
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
        // Column already exists from previous migration run — safe to ignore
      }
    }
    if (currentVersion < 2) {
      try {
        await db.execAsync(
          `ALTER TABLE outside_sessions ADD COLUMN discarded INTEGER NOT NULL DEFAULT 0`
        );
      } catch {
        // Column already exists from previous migration run — safe to ignore
      }
    }
    if (currentVersion < 3) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN steps INTEGER`);
      } catch {
        // Column already exists from previous migration run — safe to ignore
      }
    }
    if (currentVersion < 4) {
      try {
        await db.execAsync(
          `ALTER TABLE reminder_feedback ADD COLUMN scheduledMinute INTEGER NOT NULL DEFAULT 0`
        );
      } catch {
        // Column already exists from previous migration run — safe to ignore
      }
    }
    if (currentVersion < 5) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN distanceMeters REAL`);
      } catch {
        // Column already exists from previous migration run — safe to ignore
      }
    }
    if (currentVersion < 6) {
      try {
        await db.execAsync(`ALTER TABLE outside_sessions ADD COLUMN averageSpeedKmh REAL`);
      } catch {
        // Column already exists from previous migration run — safe to ignore
      }
    }
    await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
    console.log(`Database migrated from version ${currentVersion} to ${DB_VERSION}`);
  }
}

// ── Sessions ──────────────────────────────────────────────

export async function insertSessionAsync(session: OutsideSession): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO outside_sessions (startTime, endTime, durationMinutes, source, confidence, userConfirmed, notes, steps, distanceMeters, averageSpeedKmh, discarded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.startTime,
      session.endTime,
      session.durationMinutes,
      session.source,
      session.confidence,
      session.userConfirmed === null ? null : session.userConfirmed ? 1 : 0,
      session.notes ?? null,
      session.steps ?? null,
      session.distanceMeters ?? null,
      session.averageSpeedKmh ?? null,
      session.discarded ?? 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function getSessionsForDayAsync(dateMs: number): Promise<OutsideSession[]> {
  try {
    const start = startOfDay(dateMs);
    const end = start + 86400000;
    return await db.getAllAsync<OutsideSession>(
      'SELECT * FROM outside_sessions WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0 AND discarded IS NOT 1 ORDER BY startTime ASC',
      [start, end]
    );
  } catch (error) {
    console.error('[getSessionsForDayAsync] Database error:', error);
    return [];
  }
}

export async function getSessionsForRangeAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  try {
    return await db.getAllAsync<OutsideSession>(
      'SELECT * FROM outside_sessions WHERE startTime < ? AND endTime > ? ORDER BY startTime ASC',
      [toMs, fromMs]
    );
  } catch (error) {
    console.error('[getSessionsForRangeAsync] Database error:', error);
    return [];
  }
}

export async function deleteSessionAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM outside_sessions WHERE id = ?', [id]);
}

/**
 * Delete multiple sessions by ID in a single transaction.
 * Much more efficient than calling deleteSessionAsync() in a loop.
 */
export async function deleteSessionsByIdsAsync(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM outside_sessions WHERE id = ?', [id]);
    }
  });
}

/**
 * Insert multiple sessions in a single transaction.
 * Much more efficient than calling insertSessionAsync() in a loop.
 * Returns the list of inserted row IDs.
 */
export async function insertSessionsBatchAsync(sessions: OutsideSession[]): Promise<number[]> {
  if (sessions.length === 0) return [];
  const ids: number[] = [];
  await db.withTransactionAsync(async () => {
    for (const session of sessions) {
      const result = await db.runAsync(
        `INSERT INTO outside_sessions (startTime, endTime, durationMinutes, source, confidence, userConfirmed, notes, steps, distanceMeters, averageSpeedKmh, discarded)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.startTime,
          session.endTime,
          session.durationMinutes,
          session.source,
          session.confidence,
          session.userConfirmed === null ? null : session.userConfirmed ? 1 : 0,
          session.notes ?? null,
          session.steps ?? null,
          session.distanceMeters ?? null,
          session.averageSpeedKmh ?? null,
          session.discarded ?? 0,
        ]
      );
      ids.push(result.lastInsertRowId);
    }
  });
  return ids;
}

export async function getTodayMinutesAsync(): Promise<number> {
  try {
    const start = startOfDay(Date.now());
    const end = start + 86400000;
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(durationMinutes), 0) as total
       FROM outside_sessions
       WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1`,
      [start, end]
    );
    return row?.total ?? 0;
  } catch (error) {
    console.error('[getTodayMinutesAsync] Database error:', error);
    return 0;
  }
}

export async function getWeekMinutesAsync(): Promise<number> {
  try {
    const start = startOfWeek(Date.now());
    const end = Date.now();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(durationMinutes), 0) as total
       FROM outside_sessions
       WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1`,
      [start, end]
    );
    return row?.total ?? 0;
  } catch (error) {
    console.error('[getWeekMinutesAsync] Database error:', error);
    return 0;
  }
}

export async function getDailyTotalsForMonthAsync(
  dateMs: number
): Promise<{ date: number; minutes: number }[]> {
  const start = startOfMonth(dateMs);
  const end = startOfNextMonth(dateMs);
  const rows = await db.getAllAsync<{ day: number; minutes: number }>(
    `SELECT (startTime / 86400000) * 86400000 as day,
            COALESCE(SUM(durationMinutes), 0) as minutes
     FROM outside_sessions
     WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0
     GROUP BY day
     ORDER BY day ASC`,
    [start, end]
  );
  return rows.map((r) => ({ date: r.day, minutes: r.minutes }));
}

export async function confirmSessionAsync(id: number, confirmed: boolean | null): Promise<void> {
  await db.runAsync('UPDATE outside_sessions SET userConfirmed = ? WHERE id = ?', [
    confirmed === null ? null : confirmed ? 1 : 0,
    id,
  ]);
}

export async function getUnreviewedSessionsAsync(): Promise<OutsideSession[]> {
  return await db.getAllAsync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE userConfirmed IS NULL ORDER BY startTime DESC LIMIT 20'
  );
}

/**
 * Returns approved sessions only (userConfirmed = 1).
 * A session that is algorithmically discarded would never have been shown for user
 * confirmation and thus can never have userConfirmed = 1, so no extra discarded filter needed.
 */
export async function getApprovedSessionsAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ? AND userConfirmed = 1
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

/**
 * Returns all non-discarded sessions (approved + proposed + disapproved).
 */
export async function getStandardSessionsAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ? AND (discarded IS NULL OR discarded = 0)
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

/**
 * Returns all sessions including discarded.
 * NOTE: The 'all' tab is intended to include sessions marked as discarded (low-confidence).
 * Currently, no detection code sets `discarded = 1`, so 'standard' and 'all' show the same data.
 * TODO: Once buildSession/submitSession can flag unreliable sessions as discarded,
 *       the 'all' tab will diverge from 'standard'.
 */
export async function getAllSessionsIncludingDiscardedAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ?
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

/**
 * Returns the count of proposed (unreviewed) sessions that have not been discarded.
 * Used for the navigation tab badge.
 */
export async function countProposedSessionsAsync(): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM outside_sessions WHERE userConfirmed IS NULL AND (discarded IS NULL OR discarded = 0)'
    );
    return row?.cnt ?? 0;
  } catch (error) {
    console.error('[countProposedSessionsAsync] Database error:', error);
    return 0;
  }
}

/**
 * Auto-closes proposed sessions older than the given age by marking them as rejected
 * (userConfirmed = 0). This guards the "In Review" list from growing indefinitely.
 * Returns the number of rows updated.
 */
export async function autoCloseOldProposedSessionsAsync(
  maxAgeMs: number = SEVEN_DAYS_MS
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const result = await db.runAsync(
    `UPDATE outside_sessions
     SET userConfirmed = 0
     WHERE userConfirmed IS NULL AND (discarded IS NULL OR discarded = 0) AND endTime < ?`,
    [cutoff]
  );
  return result.changes;
}

/**
 * Clears the discarded flag so the user can manually review the session.
 * Sets discarded = 0 and userConfirmed = null so it surfaces in the Standard tab for review.
 */
export async function unDiscardSessionAsync(id: number): Promise<void> {
  await db.runAsync(
    'UPDATE outside_sessions SET discarded = 0, userConfirmed = NULL WHERE id = ?',
    [id]
  );
}

/**
 * Update a session's notes text.
 * Pass null or empty string to clear.
 */
export async function updateSessionNotesAsync(id: number, notes: string | null): Promise<void> {
  await db.runAsync(`UPDATE outside_sessions SET notes = ? WHERE id = ?`, [notes || null, id]);
}

/**
 * Update a session's start/end times and duration, and auto-approve it.
 * Sets userConfirmed = 1 and discarded = 0 so the session surfaces in the
 * Approved tab regardless of its previous state.
 */
export async function updateSessionTimesAsync(
  id: number,
  startTime: number,
  endTime: number
): Promise<void> {
  const durationMinutes = (endTime - startTime) / 60000;
  await db.runAsync(
    `UPDATE outside_sessions
     SET startTime = ?, endTime = ?, durationMinutes = ?, userConfirmed = 1, discarded = 0
     WHERE id = ?`,
    [startTime, endTime, durationMinutes, id]
  );
}

/**
 * Delete Health Connect sessions that are settled and either too short or too slow.
 *
 * A session is considered settled when its endTime is before `beforeMs` —
 * meaning the Health Connect sync that supplied `beforeMs` as its end time
 * has already processed every record that could have merged into it.
 *
 * Conditions for deletion (userConfirmed must be NULL in all cases):
 *   - discarded = 1 AND durationMinutes < 5  (too short — never grew into a real session), OR
 *   - steps IS NOT NULL AND durationMinutes > 0
 *       AND steps / durationMinutes < minStepsPerMinute
 *       (too slow — aggregated step rate below minimum walking speed; only for
 *        sessions that have step data)
 *
 * Returns the number of rows deleted.
 */
export async function pruneShortDiscardedHealthConnectSessionsAsync(
  beforeMs: number,
  minStepsPerMinute: number
): Promise<number> {
  const result = await db.runAsync(
    `DELETE FROM outside_sessions
     WHERE source = 'health_connect'
       AND userConfirmed IS NULL
       AND endTime < ?
       AND (
         (discarded = 1 AND durationMinutes < 5)
         OR (steps IS NOT NULL AND durationMinutes > 0 AND CAST(steps AS REAL) / durationMinutes < ?)
       )`,
    [beforeMs, minStepsPerMinute]
  );
  return result.changes;
}

// ── Goals ─────────────────────────────────────────────────

export async function getCurrentDailyGoalAsync(): Promise<DailyGoal | null> {
  try {
    return await db.getFirstAsync<DailyGoal>(
      'SELECT * FROM daily_goals ORDER BY createdAt DESC LIMIT 1'
    );
  } catch (error) {
    console.error('[getCurrentDailyGoalAsync] Database error:', error);
    return null;
  }
}

export async function getCurrentWeeklyGoalAsync(): Promise<WeeklyGoal | null> {
  try {
    return await db.getFirstAsync<WeeklyGoal>(
      'SELECT * FROM weekly_goals ORDER BY createdAt DESC LIMIT 1'
    );
  } catch (error) {
    console.error('[getCurrentWeeklyGoalAsync] Database error:', error);
    return null;
  }
}

export async function setDailyGoalAsync(minutes: number): Promise<void> {
  await db.runAsync('INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)', [
    minutes,
    Date.now(),
  ]);
}

export async function setWeeklyGoalAsync(minutes: number): Promise<void> {
  await db.runAsync('INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)', [
    minutes,
    Date.now(),
  ]);
}

// ── Streaks ───────────────────────────────────────────────

export async function getDailyStreakAsync(): Promise<number> {
  try {
    const dailyGoal = await getCurrentDailyGoalAsync();
    if (!dailyGoal) return 0;

    const targetMinutes = dailyGoal.targetMinutes;
    const todayStart = startOfDay(Date.now());
    // Look back at most 365 days to bound the query
    const cutoffMs = todayStart - 365 * 86400000;

    const rows = await db.getAllAsync<{ startTime: number; durationMinutes: number }>(
      `SELECT startTime, durationMinutes
       FROM outside_sessions
       WHERE userConfirmed = 1 AND startTime >= ?
       ORDER BY startTime DESC`,
      [cutoffMs]
    );

    // Aggregate minutes per local calendar day
    const minutesByDay = new Map<number, number>();
    for (const row of rows) {
      const dayStart = startOfDay(row.startTime);
      minutesByDay.set(dayStart, (minutesByDay.get(dayStart) ?? 0) + row.durationMinutes);
    }

    // Count consecutive days from today going backwards
    let streak = 0;
    let currentDay = todayStart;
    while (streak < 365) {
      if ((minutesByDay.get(currentDay) ?? 0) >= targetMinutes) {
        streak++;
        currentDay -= 86400000;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('[getDailyStreakAsync] Database error:', error);
    return 0;
  }
}

export async function getWeeklyStreakAsync(): Promise<number> {
  try {
    const weeklyGoal = await getCurrentWeeklyGoalAsync();
    if (!weeklyGoal) return 0;

    const targetMinutes = weeklyGoal.targetMinutes;
    const thisWeekStart = startOfWeek(Date.now());
    // Look back at most 52 weeks to bound the query
    const cutoffMs = thisWeekStart - 52 * 7 * 86400000;

    const rows = await db.getAllAsync<{ startTime: number; durationMinutes: number }>(
      `SELECT startTime, durationMinutes
       FROM outside_sessions
       WHERE userConfirmed = 1 AND startTime >= ?
       ORDER BY startTime DESC`,
      [cutoffMs]
    );

    // Aggregate minutes per local calendar week
    const minutesByWeek = new Map<number, number>();
    for (const row of rows) {
      const weekStart = startOfWeek(row.startTime);
      minutesByWeek.set(weekStart, (minutesByWeek.get(weekStart) ?? 0) + row.durationMinutes);
    }

    // Count consecutive weeks from the current week going backwards
    let streak = 0;
    let currentWeek = thisWeekStart;
    while (streak < 52) {
      if ((minutesByWeek.get(currentWeek) ?? 0) >= targetMinutes) {
        streak++;
        currentWeek -= 7 * 86400000;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('[getWeeklyStreakAsync] Database error:', error);
    return 0;
  }
}

// ── Reminder feedback ─────────────────────────────────────

export async function insertReminderFeedbackAsync(feedback: ReminderFeedback): Promise<void> {
  const d = new Date(feedback.timestamp);
  const minute = d.getMinutes();
  const slotMinute = minute >= 30 ? 30 : 0;
  await db.runAsync(
    `INSERT INTO reminder_feedback (timestamp, action, scheduledHour, scheduledMinute, dayOfWeek)
     VALUES (?, ?, ?, ?, ?)`,
    [feedback.timestamp, feedback.action, d.getHours(), slotMinute, d.getDay()]
  );
}

export async function getReminderFeedbackAsync(): Promise<ReminderFeedback[]> {
  return await db.getAllAsync<ReminderFeedback>(
    'SELECT * FROM reminder_feedback ORDER BY timestamp DESC LIMIT 200'
  );
}

// ── Known locations ───────────────────────────────────────

export async function getKnownLocationsAsync(): Promise<KnownLocation[]> {
  try {
    const rows = await db.getAllAsync<KnownLocationRow>(
      'SELECT * FROM known_locations WHERE status = ?',
      ['active']
    );
    return rows.map(mapLocation);
  } catch (error) {
    console.error('[getKnownLocationsAsync] Database error:', error);
    return [];
  }
}

export async function getAllKnownLocationsAsync(): Promise<KnownLocation[]> {
  try {
    const rows = await db.getAllAsync<KnownLocationRow>('SELECT * FROM known_locations');
    return rows.map(mapLocation);
  } catch (error) {
    console.error('[getAllKnownLocationsAsync] Database error:', error);
    return [];
  }
}

export async function getSuggestedLocationsAsync(): Promise<KnownLocation[]> {
  const rows = await db.getAllAsync<KnownLocationRow>(
    'SELECT * FROM known_locations WHERE status = ?',
    ['suggested']
  );
  return rows.map(mapLocation);
}

interface KnownLocationRow {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isIndoor: number;
  status: string;
}

interface WeatherConditionRow {
  id: number;
  timestamp: number;
  forecastHour: number;
  forecastDate: number;
  temperature: number;
  precipitationProbability: number;
  cloudCover: number;
  uvIndex: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
}

interface ScheduledNotificationRow {
  id: number;
  hour: number;
  minute: number;
  daysOfWeek: string | null;
  enabled: number;
  label: string;
}

function mapLocation(row: KnownLocationRow): KnownLocation {
  return {
    id: row.id,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radiusMeters,
    isIndoor: row.isIndoor === 1,
    status: row.status === 'suggested' ? 'suggested' : 'active',
  };
}

export async function upsertKnownLocationAsync(loc: KnownLocation): Promise<void> {
  const status = loc.status ?? 'active';
  if (loc.id) {
    await db.runAsync(
      `UPDATE known_locations SET label=?, latitude=?, longitude=?, radiusMeters=?, isIndoor=?, status=? WHERE id=?`,
      [
        loc.label,
        loc.latitude,
        loc.longitude,
        loc.radiusMeters,
        loc.isIndoor ? 1 : 0,
        status,
        loc.id,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO known_locations (label, latitude, longitude, radiusMeters, isIndoor, status) VALUES (?,?,?,?,?,?)`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0, status]
    );
  }
}

export async function denyKnownLocationAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM known_locations WHERE id = ?', [id]);
}

export async function deleteKnownLocationAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM known_locations WHERE id = ?', [id]);
}

// ── Settings ──────────────────────────────────────────────

export async function getSettingAsync(key: string, fallback: string): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return row?.value ?? fallback;
  } catch (error) {
    console.error('[getSettingAsync] Database error:', error);
    return fallback;
  }
}

export async function setSettingAsync(key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
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

// ── Date helpers ──────────────────────────────────────────

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay(); // 0 = Sunday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 6) % 7));
  return monday.getTime();
}

export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function startOfNextMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

// ── Weather ───────────────────────────────────────────────

export async function saveWeatherConditionsAsync(conditions: WeatherCondition[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const condition of conditions) {
      await db.runAsync(
        `INSERT INTO weather_conditions 
         (timestamp, forecastHour, forecastDate, temperature, precipitationProbability, 
          cloudCover, uvIndex, windSpeed, weatherCode, isDay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          condition.timestamp,
          condition.forecastHour,
          condition.forecastDate,
          condition.temperature,
          condition.precipitationProbability,
          condition.cloudCover,
          condition.uvIndex,
          condition.windSpeed,
          condition.weatherCode,
          condition.isDay ? 1 : 0,
        ]
      );
    }
  });
}

export async function getWeatherConditionsForHourAsync(
  forecastDate: number,
  startHour: number,
  endHour: number
): Promise<WeatherCondition[]> {
  const rows = await db.getAllAsync<WeatherConditionRow>(
    `SELECT * FROM weather_conditions 
     WHERE forecastDate = ? AND forecastHour >= ? AND forecastHour < ?
     ORDER BY forecastHour ASC`,
    [forecastDate, startHour, endHour]
  );

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    forecastHour: row.forecastHour,
    forecastDate: row.forecastDate,
    temperature: row.temperature,
    precipitationProbability: row.precipitationProbability,
    cloudCover: row.cloudCover,
    uvIndex: row.uvIndex,
    windSpeed: row.windSpeed,
    weatherCode: row.weatherCode,
    isDay: row.isDay === 1,
  }));
}

export async function saveWeatherCacheAsync(cache: WeatherCache): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO weather_cache (id, fetchedAt, latitude, longitude, expiresAt)
     VALUES (1, ?, ?, ?, ?)`,
    [cache.fetchedAt, cache.latitude, cache.longitude, cache.expiresAt]
  );
}

export async function getWeatherCacheAsync(): Promise<WeatherCache | null> {
  return await db.getFirstAsync<WeatherCache>('SELECT * FROM weather_cache WHERE id = 1');
}

export async function clearExpiredWeatherDataAsync(now: number): Promise<void> {
  const cutoff = now - 24 * 60 * 60 * 1000;
  await db.runAsync('DELETE FROM weather_conditions WHERE timestamp < ?', [cutoff]);
}

// ── Scheduled Notifications ───────────────────────────────

export async function getScheduledNotificationsAsync(): Promise<ScheduledNotification[]> {
  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    'SELECT * FROM scheduled_notifications ORDER BY hour, minute'
  );
  return rows.map((row) => ({
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    daysOfWeek: row.daysOfWeek
      ? row.daysOfWeek
          .split(',')
          .map((d: string) => parseInt(d.trim(), 10))
          .filter((d: number) => !isNaN(d) && d >= 0 && d <= 6) // Filter out invalid values
      : [], // Handle empty/null daysOfWeek
    enabled: row.enabled,
    label: row.label,
  }));
}

export async function insertScheduledNotificationAsync(
  notification: Omit<ScheduledNotification, 'id'>
): Promise<number> {
  // Validate daysOfWeek is not empty
  if (!notification.daysOfWeek || notification.daysOfWeek.length === 0) {
    throw new Error('Cannot insert scheduled notification without any days selected');
  }

  const result = await db.runAsync(
    'INSERT INTO scheduled_notifications (hour, minute, daysOfWeek, enabled, label) VALUES (?, ?, ?, ?, ?)',
    [
      notification.hour,
      notification.minute,
      notification.daysOfWeek.join(','),
      notification.enabled,
      notification.label,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateScheduledNotificationAsync(
  notification: ScheduledNotification
): Promise<void> {
  if (!notification.id) throw new Error('Cannot update notification without id');

  // Validate daysOfWeek is not empty
  if (!notification.daysOfWeek || notification.daysOfWeek.length === 0) {
    throw new Error('Cannot update scheduled notification without any days selected');
  }

  await db.runAsync(
    'UPDATE scheduled_notifications SET hour=?, minute=?, daysOfWeek=?, enabled=?, label=? WHERE id=?',
    [
      notification.hour,
      notification.minute,
      notification.daysOfWeek.join(','),
      notification.enabled,
      notification.label,
      notification.id,
    ]
  );
}

export async function deleteScheduledNotificationAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM scheduled_notifications WHERE id = ?', [id]);
}

export async function toggleScheduledNotificationAsync(
  id: number,
  enabled: boolean
): Promise<void> {
  await db.runAsync('UPDATE scheduled_notifications SET enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    id,
  ]);
}

export async function cleanupInvalidScheduledNotificationsAsync(): Promise<number> {
  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications 
     WHERE daysOfWeek = '' 
        OR daysOfWeek IS NULL 
        OR length(trim(daysOfWeek)) = 0`
  );

  const deletedCount = result.changes;
  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} corrupted scheduled notification(s)`);
  }

  return deletedCount;
}

// ── Background task logs ──────────────────────────────────

export type BackgroundLogCategory = 'gps' | 'health_connect' | 'reminder';

export interface BackgroundTaskLog {
  id?: number;
  timestamp: number;
  category: BackgroundLogCategory;
  message: string;
}

/** Maximum number of log entries to keep per category (oldest are pruned). */
const MAX_LOGS_PER_CATEGORY = 200;

export async function insertBackgroundLogAsync(
  category: BackgroundLogCategory,
  message: string
): Promise<void> {
  try {
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO background_task_logs (timestamp, category, message) VALUES (?, ?, ?)',
      [now, category, message]
    );
    await db.runAsync(
      `DELETE FROM background_task_logs
       WHERE category = ?
         AND id NOT IN (
           SELECT id FROM background_task_logs
           WHERE category = ?
           ORDER BY timestamp DESC
           LIMIT ?
         )`,
      [category, category, MAX_LOGS_PER_CATEGORY]
    );
  } catch {
    // Log writing is best-effort — never crash the background task
  }
}

/**
 * Retrieve background task log entries, optionally filtered by category.
 * Returns entries ordered newest first.
 */
export async function getBackgroundLogsAsync(
  category?: BackgroundLogCategory,
  limit = 200
): Promise<BackgroundTaskLog[]> {
  try {
    if (category) {
      return await db.getAllAsync<BackgroundTaskLog>(
        'SELECT id, timestamp, category, message FROM background_task_logs WHERE category = ? ORDER BY timestamp DESC LIMIT ?',
        [category, limit]
      );
    }
    return await db.getAllAsync<BackgroundTaskLog>(
      'SELECT id, timestamp, category, message FROM background_task_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  } catch {
    return [];
  }
}
