import { db, initDatabaseAsync } from '../db';
import { ReminderFeedback, ScheduledNotification } from '../types';

interface ScheduledNotificationRow {
  id: number;
  hour: number;
  minute: number;
  daysOfWeek: string | null;
  enabled: number;
  label: string;
}

export async function insertReminderFeedbackAsync(feedback: ReminderFeedback): Promise<void> {
  await initDatabaseAsync();
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
  await initDatabaseAsync();
  return await db.getAllAsync<ReminderFeedback>(
    'SELECT * FROM reminder_feedback ORDER BY timestamp DESC LIMIT 200'
  );
}

export async function getScheduledNotificationsAsync(): Promise<ScheduledNotification[]> {
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
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
  await initDatabaseAsync();
  await db.runAsync('DELETE FROM scheduled_notifications WHERE id = ?', [id]);
}

export async function toggleScheduledNotificationAsync(
  id: number,
  enabled: boolean
): Promise<void> {
  await initDatabaseAsync();
  await db.runAsync('UPDATE scheduled_notifications SET enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    id,
  ]);
}

export async function cleanupInvalidScheduledNotificationsAsync(): Promise<number> {
  await initDatabaseAsync();
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
