import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getScheduledNotifications, ScheduledNotification } from '../storage/database';

const SCHEDULED_CHANNEL_ID = 'touchgrass_scheduled';
const SCHEDULED_NOTIFICATION_PREFIX = 'scheduled_';

/**
 * Set up the scheduled notification channel (Android only).
 * Should be called during app initialization.
 */
export async function setupScheduledNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(SCHEDULED_CHANNEL_ID, {
        name: 'Scheduled Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A7C59',
      });
      console.log('TouchGrass: Scheduled notification channel created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create scheduled channel:', e);
    }
  }
}

/**
 * Schedule all enabled scheduled notifications using calendar triggers.
 * Cancels existing scheduled notifications first.
 */
export async function scheduleAllScheduledNotifications(): Promise<void> {
  // Cancel all existing scheduled notifications
  const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of allNotifications) {
    if (notif.identifier.startsWith(SCHEDULED_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  // Get all enabled scheduled notifications from database
  const schedules = getScheduledNotifications().filter(s => s.enabled === 1);

  // Schedule each one
  for (const schedule of schedules) {
    await scheduleNotification(schedule);
  }

  console.log(`TouchGrass: Scheduled ${schedules.length} notifications`);
}

/**
 * Schedule a single notification using calendar trigger for weekly recurrence.
 */
async function scheduleNotification(schedule: ScheduledNotification): Promise<void> {
  if (!schedule.id) return;

  // For each day of week this notification should fire
  for (const dayOfWeek of schedule.daysOfWeek) {
    const identifier = `${SCHEDULED_NOTIFICATION_PREFIX}${schedule.id}_${dayOfWeek}`;
    
    const title = schedule.label || '🌿 Time to touch grass!';
    const body = 'Your scheduled reminder to spend time outside.';

    try {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          categoryIdentifier: 'reminder',
          data: { 
            scheduledNotificationId: schedule.id,
            isScheduled: true,
          },
          color: '#4A7C59',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          repeats: true,
          weekday: dayOfWeek + 1, // Expo uses 1-7 (1=Sunday), we use 0-6 (0=Sunday)
          hour: schedule.hour,
          minute: schedule.minute,
          channelId: SCHEDULED_CHANNEL_ID,
        },
      });
    } catch (error) {
      console.error(`Error scheduling notification for ${identifier}:`, error);
    }
  }
}

/**
 * Check if there's a scheduled notification within the given time window (in minutes).
 * Used to avoid overlapping automatic reminders with scheduled ones.
 */
export function hasScheduledNotificationNearby(windowMinutes: number): boolean {
  const schedules = getScheduledNotifications().filter(s => s.enabled === 1);
  const now = new Date();
  const currentDay = now.getDay(); // 0-6 (0=Sunday)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  for (const schedule of schedules) {
    // Check if this schedule applies to today
    if (!schedule.daysOfWeek.includes(currentDay)) continue;

    const scheduledTotalMinutes = schedule.hour * 60 + schedule.minute;
    const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);

    // Check if within window
    if (diff <= windowMinutes) {
      return true;
    }
  }

  return false;
}

/**
 * Cancel all scheduled notifications.
 * Used when user disables scheduled reminders or clears data.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of allNotifications) {
    if (notif.identifier.startsWith(SCHEDULED_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
  console.log('TouchGrass: Cancelled all scheduled notifications');
}
