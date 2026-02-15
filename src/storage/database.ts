import * as SQLite from 'expo-sqlite';

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
     WHERE startTime >= ? AND startTime < ?`,
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
     WHERE startTime >= ? AND startTime < ?`,
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

export function confirmSession(id: number, confirmed: boolean): void {
  db.runSync(
    'UPDATE outside_sessions SET userConfirmed = ? WHERE id = ?',
    [confirmed ? 1 : 0, id]
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