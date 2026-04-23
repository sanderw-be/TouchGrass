import { SQLiteDatabase } from 'expo-sqlite';
import { OutsideSession, DailyGoal } from './types';
import { WeatherCondition, WeatherCache } from '../weather/types';

export interface IStorageService {
  // Settings
  getSettingAsync(key: string, fallback: string): Promise<string>;
  setSettingAsync(key: string, value: string): Promise<void>;

  // Sessions
  insertSessionAsync(session: OutsideSession): Promise<number>;
  getTodayMinutesAsync(): Promise<number>;
  getCurrentDailyGoalAsync(): Promise<DailyGoal | null>;
  getSessionsForRangeAsync(fromMs: number, toMs: number): Promise<OutsideSession[]>;
  insertReminderFeedbackAsync(feedback: {
    timestamp: number;
    action: string;
    scheduledHour: number;
    scheduledMinute: number;
    dayOfWeek: number;
  }): Promise<void>;
  getScheduledNotificationsAsync(): Promise<
    {
      id: number;
      daysOfWeek: number[];
      hour: number;
      minute: number;
      enabled: number;
      label: string;
    }[]
  >;
  insertBackgroundLogAsync(source: string, message: string): Promise<void>;

  // Weather
  getWeatherCacheAsync(): Promise<WeatherCache | null>;
  getWeatherConditionsForHourAsync(
    dateMs: number,
    startHour: number,
    endHour: number
  ): Promise<WeatherCondition[]>;
  saveWeatherConditionsAsync(conditions: WeatherCondition[]): Promise<void>;
  clearExpiredWeatherDataAsync(beforeMs: number): Promise<void>;
  saveWeatherCacheAsync(cache: WeatherCache): Promise<void>;

  // ... (More will be added as we migrate repositories)
}

export class StorageService implements IStorageService {
  constructor(private db: SQLiteDatabase) {}

  async getSettingAsync(key: string, fallback: string): Promise<string> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return row?.value ?? fallback;
  }

  async setSettingAsync(key: string, value: string): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
      key,
      value,
    ]);
  }

  async insertSessionAsync(session: OutsideSession): Promise<number> {
    const result = await this.db.runAsync(
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

  async getTodayMinutesAsync(): Promise<number> {
    // Note: This logic normally uses startOfDay helper, but for initial StorageService
    // I am keeping it simple or injecting helpers too if needed.
    // For now, let's keep it direct.
    const now = Date.now();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 86400000;

    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(durationMinutes), 0) as total
       FROM outside_sessions
       WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1`,
      [start, end]
    );
    return row?.total ?? 0;
  }

  async getCurrentDailyGoalAsync(): Promise<DailyGoal | null> {
    return await this.db.getFirstAsync<DailyGoal>(
      'SELECT * FROM daily_goals ORDER BY createdAt DESC LIMIT 1'
    );
  }

  async getSessionsForRangeAsync(fromMs: number, toMs: number): Promise<OutsideSession[]> {
    return await this.db.getAllAsync<OutsideSession>(
      'SELECT * FROM outside_sessions WHERE startTime < ? AND endTime > ? ORDER BY startTime ASC',
      [toMs, fromMs]
    );
  }

  async insertReminderFeedbackAsync(feedback: {
    timestamp: number;
    action: string;
    scheduledHour: number;
    scheduledMinute: number;
    dayOfWeek: number;
  }): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO reminder_feedback (timestamp, action, scheduledHour, scheduledMinute, dayOfWeek)
       VALUES (?, ?, ?, ?, ?)`,
      [
        feedback.timestamp,
        feedback.action,
        feedback.scheduledHour,
        feedback.scheduledMinute,
        feedback.dayOfWeek,
      ]
    );
  }

  async getScheduledNotificationsAsync(): Promise<
    {
      id: number;
      daysOfWeek: number[];
      hour: number;
      minute: number;
      enabled: number;
      label: string;
    }[]
  > {
    const rows = await this.db.getAllAsync<{
      id: number;
      daysOfWeek: string;
      hour: number;
      minute: number;
      enabled: number;
      label: string;
    }>('SELECT * FROM scheduled_notifications ORDER BY hour, minute');

    return rows.map((row) => ({
      id: row.id,
      hour: row.hour,
      minute: row.minute,
      daysOfWeek: row.daysOfWeek
        ? row.daysOfWeek
            .split(',')
            .map((d) => parseInt(d.trim(), 10))
            .filter((d) => !isNaN(d))
        : [],
      enabled: row.enabled,
      label: row.label,
    }));
  }

  async insertBackgroundLogAsync(source: string, message: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO background_task_logs (timestamp, category, message) VALUES (?, ?, ?)',
      [Date.now(), source, message]
    );
  }

  async getWeatherCacheAsync(): Promise<WeatherCache | null> {
    const raw = await this.getSettingAsync('weather_cache', '');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async getWeatherConditionsForHourAsync(
    dateMs: number,
    startHour: number,
    endHour: number
  ): Promise<WeatherCondition[]> {
    return await this.db.getAllAsync<WeatherCondition>(
      'SELECT * FROM weather_conditions WHERE forecastDate = ? AND forecastHour >= ? AND forecastHour < ? ORDER BY forecastHour ASC',
      [dateMs, startHour, endHour]
    );
  }

  async saveWeatherConditionsAsync(conditions: WeatherCondition[]): Promise<void> {
    for (const c of conditions) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO weather_conditions (forecastDate, forecastHour, temperature, weatherCode, isDay)
         VALUES (?, ?, ?, ?, ?)`,
        [c.forecastDate, c.forecastHour, c.temperature, c.weatherCode, c.isDay ? 1 : 0]
      );
    }
  }

  async clearExpiredWeatherDataAsync(beforeMs: number): Promise<void> {
    await this.db.runAsync('DELETE FROM weather_conditions WHERE forecastDate < ?', [beforeMs]);
  }

  async saveWeatherCacheAsync(cache: WeatherCache): Promise<void> {
    await this.setSettingAsync('weather_cache', JSON.stringify(cache));
  }
}
