import { db, initDatabaseAsync } from '../db';
import { BackgroundLogCategory, BackgroundTaskLog } from '../types';

/** Maximum number of log entries to keep per category (oldest are pruned). */
const MAX_LOGS_PER_CATEGORY = 200;

export async function insertBackgroundLogAsync(
  category: BackgroundLogCategory,
  message: string
): Promise<void> {
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
