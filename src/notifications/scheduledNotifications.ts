import * as Notifications from 'expo-notifications';
import { getScheduledNotifications } from '../storage/database';

// Prefix for scheduled notification identifiers
const SCHEDULED_NOTIF_PREFIX = 'scheduled_';

/**
 * Schedule all enabled scheduled notifications using calendar triggers.
 * These recur weekly on the specified days.
 */
export async function scheduleAllScheduledNotifications(): Promise<void> {
  try {
    const schedules = getScheduledNotifications();
    const enabled = schedules.filter(s => s.enabled === 1);

    // Cancel existing scheduled notifications (prefix-based)
    await cancelAllScheduledNotifications();

    let totalScheduled = 0;
    for (const schedule of enabled) {
      for (const dayOfWeek of schedule.daysOfWeek) {
        // Schedule a weekly recurring notification for this day and time
        const notificationId = `${SCHEDULED_NOTIF_PREFIX}${schedule.id}_${dayOfWeek}`;
        
        // Convert JavaScript day (0=Sunday) to Expo weekday (1=Sunday)
        const expoWeekday = dayOfWeek === 0 ? 1 : dayOfWeek + 1;
        
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: schedule.label || '🌿 Time to touch grass!',
              body: 'Your scheduled reminder to go outside.',
              sound: true,
              color: '#4A7C59',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              repeats: true,
              weekday: expoWeekday,
              hour: schedule.hour,
              minute: schedule.minute,
              second: 0,
              channelId: 'touchgrass_scheduled',
            },
          });
          totalScheduled++;
          console.log(`Scheduled notification ${notificationId} for weekday ${expoWeekday} at ${schedule.hour}:${schedule.minute}`);
        } catch (error) {
          console.error(`Failed to schedule notification ${notificationId}:`, error);
        }
      }
    }

    console.log(`Successfully scheduled ${totalScheduled} recurring notifications from ${enabled.length} schedules`);
  } catch (error) {
    console.error('Error in scheduleAllScheduledNotifications:', error);
    throw error;
  }
}

/**
 * Cancel all scheduled notifications (those with our prefix).
 * Preserves automatic/smart reminders.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notif of all) {
    if (notif.identifier.startsWith(SCHEDULED_NOTIF_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Check if there's a scheduled notification within the given window (in minutes)
 * of the current time. Used to avoid conflicts with automatic reminders.
 * 
 * @param windowMinutes - How many minutes before/after to check (e.g., 60 for 1 hour window)
 * @returns true if a scheduled notification is nearby
 */
export function hasScheduledNotificationNearby(windowMinutes: number): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday, 6=Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const schedules = getScheduledNotifications();
  const enabled = schedules.filter(s => s.enabled === 1);

  for (const schedule of enabled) {
    // Check if this schedule applies to today
    if (!schedule.daysOfWeek.includes(currentDay)) continue;

    const scheduledMinutes = schedule.hour * 60 + schedule.minute;
    const diff = Math.abs(currentMinutes - scheduledMinutes);

    // Check if within window (also handle wrap-around at midnight)
    if (diff <= windowMinutes || diff >= (24 * 60 - windowMinutes)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all currently scheduled notifications (for debugging)
 */
export async function getAllScheduledNotificationsDebug(): Promise<any[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const scheduled = all.filter(n => n.identifier.startsWith(SCHEDULED_NOTIF_PREFIX));
  console.log(`Found ${scheduled.length} scheduled notifications:`, scheduled);
  return scheduled;
}
