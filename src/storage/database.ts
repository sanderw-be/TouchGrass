import * as SQLite from 'expo-sqlite';
import { WeatherCondition, WeatherCache } from '../weather/types';

const db = SQLite.openDatabaseSync('touchgrass.db');

export interface OutsideSession {
  id?: number;
  startTime: number;       // unix timestamp ms
  endTime: number;         // unix timestamp ms
  durationMinutes: number;
  source: 'health_connect' | 'gps' | 'manual' | 'timeline';
  confidence: number;      // 0-1, how sure are we this was outside?
  userConfirmed: number | null;  // 0, 1, or null — SQLite has no boolean, null = not reviewed, true/false = user feedback
  notes?: string;
  steps?: number;          // aggregated step count from Health Connect steps records
  discarded: number;       // 1 = algorithmically discarded (too unreliable to propose), 0 = normal session
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
  action: 'snoozed' | 'dismissed' | 'went_outside' | 'less_often' | 'more_often';
  scheduledHour: number;   // 0-23, what hour the reminder fired
  dayOfWeek: number;       // 0-6
}

export interface KnownLocation {
  id?: number;
  label: string;           // 'home', 'work', or custom
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isIndoor: boolean;
  status: 'active' | 'suggested';  // 'suggested' = pending user approval
}

export interface ScheduledNotification {
  id?: number;
  hour: number;            // 0-23
  minute: number;          // 0-59
  daysOfWeek: number[];    // 0-6, Sunday=0
  enabled: number;         // 0 or 1 (SQLite boolean)
  label: string;           // optional label like "Morning walk"
}

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS outside_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      durationMinutes REAL NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.8,
      userConfirmed INTEGER,
      notes TEXT,
      steps INTEGER
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
  `);

  // Seed default goals if none exist
  const goalCount = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_goals'
  );
  if (goalCount?.count === 0) {
    db.runSync(
      'INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)',
      [30, Date.now()]
    );
    db.runSync(
      'INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)',
      [150, Date.now()]
    );
  }
  
  // Clean up any corrupted scheduled notifications (one-time migration)
  try {
    const deletedCount = cleanupInvalidScheduledNotifications();
    if (deletedCount > 0) {
      console.log(`Database migration: Removed ${deletedCount} corrupted scheduled notification(s)`);
    }
  } catch (error) {
    console.error('Error cleaning up scheduled notifications:', error);
  }

  // Add status column to known_locations if it doesn't exist (migration)
  try {
    db.execSync(`ALTER TABLE known_locations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
    console.log('Database migration: Added status column to known_locations');
  } catch {
    // Column already exists — safe to ignore
  }

  // Add discarded column to outside_sessions if it doesn't exist (migration)
  try {
    db.execSync(`ALTER TABLE outside_sessions ADD COLUMN discarded INTEGER NOT NULL DEFAULT 0`);
    console.log('Database migration: Added discarded column to outside_sessions');
  } catch {
    // Column already exists — safe to ignore
  }

  // Add steps column to outside_sessions if it doesn't exist (migration)
  try {
    db.execSync(`ALTER TABLE outside_sessions ADD COLUMN steps INTEGER`);
    console.log('Database migration: Added steps column to outside_sessions');
  } catch {
    // Column already exists — safe to ignore
  }
}

// ── Sessions ──────────────────────────────────────────────

export function insertSession(session: OutsideSession): number {
  const result = db.runSync(
    `INSERT INTO outside_sessions (startTime, endTime, durationMinutes, source, confidence, userConfirmed, notes, steps, discarded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.startTime,
      session.endTime,
      session.durationMinutes,
      session.source,
      session.confidence,
      session.userConfirmed === null ? null : session.userConfirmed ? 1 : 0,
      session.notes ?? null,
      session.steps ?? null,
      session.discarded ?? 0,
    ]
  );
  return result.lastInsertRowId;
}

export function getSessionsForDay(dateMs: number): OutsideSession[] {
  const start = startOfDay(dateMs);
  const end = start + 86400000;
  return db.getAllSync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0 ORDER BY startTime ASC',
    [start, end]
  );
}

export function getSessionsForRange(fromMs: number, toMs: number): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE startTime < ? AND endTime > ? ORDER BY startTime ASC',
    [toMs, fromMs]
  );
}

export function deleteSession(id: number): void {
  db.runSync('DELETE FROM outside_sessions WHERE id = ?', [id]);
}

export function getTodayMinutes(): number {
  const start = startOfDay(Date.now());
  const end = start + 86400000;
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(durationMinutes), 0) as total
     FROM outside_sessions
     WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1`,
    [start, end]
  );
  return row?.total ?? 0;
}

export function getWeekMinutes(): number {
  const start = startOfWeek(Date.now());
  const end = Date.now();
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(durationMinutes), 0) as total
     FROM outside_sessions
     WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1`,
    [start, end]
  );
  return row?.total ?? 0;
}

export function getDailyTotalsForMonth(dateMs: number): { date: number; minutes: number }[] {
  const start = startOfMonth(dateMs);
  const end = startOfNextMonth(dateMs);
  const rows = db.getAllSync<{ day: number; minutes: number }>(
    `SELECT (startTime / 86400000) * 86400000 as day,
            COALESCE(SUM(durationMinutes), 0) as minutes
     FROM outside_sessions
     WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0
     GROUP BY day
     ORDER BY day ASC`,
    [start, end]
  );
  return rows.map(r => ({ date: r.day, minutes: r.minutes }));
}

export function confirmSession(id: number, confirmed: boolean | null): void {
  db.runSync(
    'UPDATE outside_sessions SET userConfirmed = ? WHERE id = ?',
    [confirmed === null ? null : (confirmed ? 1 : 0), id]
  );
}

export function getUnreviewedSessions(): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE userConfirmed IS NULL ORDER BY startTime DESC LIMIT 20'
  );
}

/**
 * Returns approved sessions only (userConfirmed = 1).
 * A session that is algorithmically discarded would never have been shown for user
 * confirmation and thus can never have userConfirmed = 1, so no extra discarded filter needed.
 */
export function getApprovedSessions(fromMs: number, toMs: number): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ? AND userConfirmed = 1
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

/**
 * Returns all non-discarded sessions (approved + proposed + disapproved).
 */
export function getStandardSessions(fromMs: number, toMs: number): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
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
export function getAllSessionsIncludingDiscarded(fromMs: number, toMs: number): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ?
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

/**
 * Clears the discarded flag so the user can manually review the session.
 * Sets discarded = 0 and userConfirmed = null so it surfaces in the Standard tab for review.
 */
export function unDiscardSession(id: number): void {
  db.runSync(
    'UPDATE outside_sessions SET discarded = 0, userConfirmed = NULL WHERE id = ?',
    [id]
  );
}

/**
 * Update a session's start/end times and duration, and auto-approve it.
 * Sets userConfirmed = 1 and discarded = 0 so the session surfaces in the
 * Approved tab regardless of its previous state.
 */
export function updateSessionTimes(id: number, startTime: number, endTime: number): void {
  const durationMinutes = (endTime - startTime) / 60000;
  db.runSync(
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
export function pruneShortDiscardedHealthConnectSessions(
  beforeMs: number,
  minStepsPerMinute: number,
): number {
  const result = db.runSync(
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

export function getCurrentDailyGoal(): DailyGoal | null {
  return db.getFirstSync<DailyGoal>(
    'SELECT * FROM daily_goals ORDER BY createdAt DESC LIMIT 1'
  );
}

export function getCurrentWeeklyGoal(): WeeklyGoal | null {
  return db.getFirstSync<WeeklyGoal>(
    'SELECT * FROM weekly_goals ORDER BY createdAt DESC LIMIT 1'
  );
}

export function setDailyGoal(minutes: number): void {
  db.runSync(
    'INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)',
    [minutes, Date.now()]
  );
}

export function setWeeklyGoal(minutes: number): void {
  db.runSync(
    'INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)',
    [minutes, Date.now()]
  );
}

// ── Reminder feedback ─────────────────────────────────────

export function insertReminderFeedback(feedback: ReminderFeedback): void {
  const d = new Date(feedback.timestamp);
  db.runSync(
    `INSERT INTO reminder_feedback (timestamp, action, scheduledHour, dayOfWeek)
     VALUES (?, ?, ?, ?)`,
    [feedback.timestamp, feedback.action, d.getHours(), d.getDay()]
  );
}

export function getReminderFeedback(): ReminderFeedback[] {
  return db.getAllSync<ReminderFeedback>(
    'SELECT * FROM reminder_feedback ORDER BY timestamp DESC LIMIT 200'
  );
}

// ── Known locations ───────────────────────────────────────

export function getKnownLocations(): KnownLocation[] {
  return db.getAllSync<any>('SELECT * FROM known_locations WHERE status = ?', ['active']).map(mapLocation);
}

export function getAllKnownLocations(): KnownLocation[] {
  return db.getAllSync<any>('SELECT * FROM known_locations').map(mapLocation);
}

export function getSuggestedLocations(): KnownLocation[] {
  return db.getAllSync<any>('SELECT * FROM known_locations WHERE status = ?', ['suggested']).map(mapLocation);
}

function mapLocation(row: any): KnownLocation {
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

export function upsertKnownLocation(loc: KnownLocation): void {
  const status = loc.status ?? 'active';
  if (loc.id) {
    db.runSync(
      `UPDATE known_locations SET label=?, latitude=?, longitude=?, radiusMeters=?, isIndoor=?, status=? WHERE id=?`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0, status, loc.id]
    );
  } else {
    db.runSync(
      `INSERT INTO known_locations (label, latitude, longitude, radiusMeters, isIndoor, status) VALUES (?,?,?,?,?,?)`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0, status]
    );
  }
}

export function approveKnownLocation(id: number, label: string): void {
  db.runSync(
    `UPDATE known_locations SET status='active', label=? WHERE id=?`,
    [label, id]
  );
}

export function denyKnownLocation(id: number): void {
  db.runSync('DELETE FROM known_locations WHERE id = ?', [id]);
}

export function deleteKnownLocation(id: number): void {
  db.runSync('DELETE FROM known_locations WHERE id = ?', [id]);
}

// ── Settings ──────────────────────────────────────────────

export function getSetting(key: string, fallback: string): string {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?', [key]
  );
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// ── Clear all data ────────────────────────────────────────

export function clearAllData(): void {
  console.log('[Database] Clearing all data...');
  
  // Delete all sessions
  db.runSync('DELETE FROM outside_sessions');
  
  // Delete reminder feedback
  db.runSync('DELETE FROM reminder_feedback');
  
  // Reset goals to defaults
  db.runSync('DELETE FROM daily_goals');
  db.runSync('DELETE FROM weekly_goals');
  db.runSync(
    'INSERT INTO daily_goals (targetMinutes, createdAt) VALUES (?, ?)',
    [30, Date.now()]
  );
  db.runSync(
    'INSERT INTO weekly_goals (targetMinutes, createdAt) VALUES (?, ?)',
    [150, Date.now()]
  );
  
  // Clear non-essential settings (keep language only; hasCompletedIntro is reset so tutorial shows again)
  db.runSync('DELETE FROM app_settings WHERE key NOT IN (?)', ['language']);
  
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

export function saveWeatherConditions(conditions: WeatherCondition[]): void {
  for (const condition of conditions) {
    db.runSync(
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
}

export function getWeatherConditionsForHour(
  forecastDate: number,
  startHour: number,
  endHour: number
): WeatherCondition[] {
  const rows = db.getAllSync<any>(
    `SELECT * FROM weather_conditions 
     WHERE forecastDate = ? AND forecastHour >= ? AND forecastHour < ?
     ORDER BY forecastHour ASC`,
    [forecastDate, startHour, endHour]
  );
  
  return rows.map(row => ({
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

export function saveWeatherCache(cache: WeatherCache): void {
  db.runSync(
    `INSERT OR REPLACE INTO weather_cache (id, fetchedAt, latitude, longitude, expiresAt)
     VALUES (1, ?, ?, ?, ?)`,
    [cache.fetchedAt, cache.latitude, cache.longitude, cache.expiresAt]
  );
}

export function getWeatherCache(): WeatherCache | null {
  return db.getFirstSync<WeatherCache>(
    'SELECT * FROM weather_cache WHERE id = 1'
  );
}

export function clearExpiredWeatherData(now: number): void {
  // Delete weather conditions older than 24 hours
  const cutoff = now - 24 * 60 * 60 * 1000;
  db.runSync('DELETE FROM weather_conditions WHERE timestamp < ?', [cutoff]);
}

// ── Scheduled Notifications ───────────────────────────────

export function getScheduledNotifications(): ScheduledNotification[] {
  const rows = db.getAllSync<any>('SELECT * FROM scheduled_notifications ORDER BY hour, minute');
  return rows.map(row => ({
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

export function insertScheduledNotification(notification: Omit<ScheduledNotification, 'id'>): number {
  // Validate daysOfWeek is not empty
  if (!notification.daysOfWeek || notification.daysOfWeek.length === 0) {
    throw new Error('Cannot insert scheduled notification without any days selected');
  }
  
  const result = db.runSync(
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

export function updateScheduledNotification(notification: ScheduledNotification): void {
  if (!notification.id) throw new Error('Cannot update notification without id');
  
  // Validate daysOfWeek is not empty
  if (!notification.daysOfWeek || notification.daysOfWeek.length === 0) {
    throw new Error('Cannot update scheduled notification without any days selected');
  }
  
  db.runSync(
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

export function deleteScheduledNotification(id: number): void {
  db.runSync('DELETE FROM scheduled_notifications WHERE id = ?', [id]);
}

export function toggleScheduledNotification(id: number, enabled: boolean): void {
  db.runSync(
    'UPDATE scheduled_notifications SET enabled = ? WHERE id = ?',
    [enabled ? 1 : 0, id]
  );
}

/**
 * Clean up corrupted scheduled notifications with invalid daysOfWeek data.
 * This removes notifications that have empty or invalid day selections.
 */
export function cleanupInvalidScheduledNotifications(): number {
  // Find and delete notifications with empty or invalid daysOfWeek
  const result = db.runSync(
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