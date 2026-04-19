import { db } from '../db';
import { DailyGoal, WeeklyGoal } from '../types';
import { startOfDay, startOfWeek } from '../dateHelpers';

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
