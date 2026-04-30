import { db, initDatabaseAsync, SEVEN_DAYS_MS } from '../db';
import { OutsideSession } from '../types';
import { startOfDay, startOfWeek, startOfMonth, startOfNextMonth } from '../dateHelpers';

export async function insertSessionAsync(session: OutsideSession): Promise<number> {
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
  await db.runAsync('DELETE FROM outside_sessions WHERE id = ?', [id]);
}

export async function deleteSessionsByIdsAsync(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await initDatabaseAsync();
  await db.withExclusiveTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM outside_sessions WHERE id = ?', [id]);
    }
  });
}

export async function insertSessionsBatchAsync(sessions: OutsideSession[]): Promise<number[]> {
  if (sessions.length === 0) return [];
  await initDatabaseAsync();
  const ids: number[] = [];
  await db.withExclusiveTransactionAsync(async () => {
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
  await db.runAsync('UPDATE outside_sessions SET userConfirmed = ? WHERE id = ?', [
    confirmed === null ? null : confirmed ? 1 : 0,
    id,
  ]);
}

export async function getUnreviewedSessionsAsync(): Promise<OutsideSession[]> {
  await initDatabaseAsync();
  return await db.getAllAsync<OutsideSession>(
    'SELECT * FROM outside_sessions WHERE userConfirmed IS NULL ORDER BY startTime DESC LIMIT 20'
  );
}

export async function getApprovedSessionsAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  await initDatabaseAsync();
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ? AND userConfirmed = 1
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

export async function getStandardSessionsAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  await initDatabaseAsync();
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ? AND (discarded IS NULL OR discarded = 0)
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

export async function getAllSessionsIncludingDiscardedAsync(
  fromMs: number,
  toMs: number
): Promise<OutsideSession[]> {
  await initDatabaseAsync();
  return await db.getAllAsync<OutsideSession>(
    `SELECT * FROM outside_sessions
     WHERE startTime < ? AND endTime > ?
     ORDER BY startTime DESC`,
    [toMs, fromMs]
  );
}

export async function countProposedSessionsAsync(): Promise<number> {
  await initDatabaseAsync();
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

export async function autoCloseOldProposedSessionsAsync(
  maxAgeMs: number = SEVEN_DAYS_MS
): Promise<number> {
  await initDatabaseAsync();
  const cutoff = Date.now() - maxAgeMs;
  const result = await db.runAsync(
    `UPDATE outside_sessions
     SET userConfirmed = 0
     WHERE userConfirmed IS NULL AND (discarded IS NULL OR discarded = 0) AND endTime < ?`,
    [cutoff]
  );
  return result.changes;
}

export async function unDiscardSessionAsync(id: number): Promise<void> {
  await initDatabaseAsync();
  await db.runAsync(
    'UPDATE outside_sessions SET discarded = 0, userConfirmed = NULL WHERE id = ?',
    [id]
  );
}

export async function updateSessionNotesAsync(id: number, notes: string | null): Promise<void> {
  await initDatabaseAsync();
  await db.runAsync(`UPDATE outside_sessions SET notes = ? WHERE id = ?`, [notes || null, id]);
}

export async function updateSessionTimesAsync(
  id: number,
  startTime: number,
  endTime: number
): Promise<void> {
  await initDatabaseAsync();
  const durationMinutes = (endTime - startTime) / 60000;
  await db.runAsync(
    `UPDATE outside_sessions
     SET startTime = ?, endTime = ?, durationMinutes = ?, userConfirmed = 1, discarded = 0
     WHERE id = ?`,
    [startTime, endTime, durationMinutes, id]
  );
}

export async function pruneShortDiscardedHealthConnectSessionsAsync(
  beforeMs: number,
  minStepsPerMinute: number
): Promise<number> {
  await initDatabaseAsync();
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
