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
      notes TEXT
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
      isIndoor INTEGER NOT NULL DEFAULT 1
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
}

// ── Sessions ──────────────────────────────────────────────

export function insertSession(session: OutsideSession): number {
  const result = db.runSync(
    `INSERT INTO outside_sessions (startTime, endTime, durationMinutes, source, confidence, userConfirmed, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.startTime,
      session.endTime,
      session.durationMinutes,
      session.source,
      session.confidence,
      session.userConfirmed === null ? null : session.userConfirmed ? 1 : 0,
      session.notes ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export function getSessionsForDay(dateMs: number): OutsideSession[] {
  const start = startOfDay(dateMs);
  const end = start + 86400000;
  return db.getAllSync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE startTime >= ? AND startTime < ? ORDER BY startTime ASC',
    [start, end]
  );
}

export function getSessionsForRange(fromMs: number, toMs: number): OutsideSession[] {
  return db.getAllSync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE startTime >= ? AND startTime < ? ORDER BY startTime ASC',
    [fromMs, toMs]
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
     WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0`,
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
     WHERE startTime >= ? AND startTime < ? AND userConfirmed IS NOT 0`,
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
  return db.getAllSync<KnownLocation>('SELECT * FROM known_locations');
}

export function upsertKnownLocation(loc: KnownLocation): void {
  if (loc.id) {
    db.runSync(
      `UPDATE known_locations SET label=?, latitude=?, longitude=?, radiusMeters=?, isIndoor=? WHERE id=?`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0, loc.id]
    );
  } else {
    db.runSync(
      `INSERT INTO known_locations (label, latitude, longitude, radiusMeters, isIndoor) VALUES (?,?,?,?,?)`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0]
    );
  }
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
  
  // Clear non-essential settings (keep language, hasCompletedIntro)
  db.runSync('DELETE FROM app_settings WHERE key NOT IN (?, ?)', ['language', 'hasCompletedIntro']);
  
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
      .split(',')
      .map((d: string) => parseInt(d.trim(), 10))
      .filter((d: number) => !isNaN(d) && d >= 0 && d <= 6), // Filter out invalid values
    enabled: row.enabled,
    label: row.label,
  }));
}

export function insertScheduledNotification(notification: Omit<ScheduledNotification, 'id'>): number {
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