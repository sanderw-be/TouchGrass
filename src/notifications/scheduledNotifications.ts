import * as Notifications from 'expo-notifications';
import { getScheduledNotifications, ScheduledNotification } from '../storage/database';
import { t } from '../i18n';

const SCHEDULED_CHANNEL_ID = 'touchgrass_scheduled';
const SCHEDULED_NOTIFICATION_PREFIX = 'scheduled_';

/**
 * Schedule all enabled scheduled notifications.
 * This should be called whenever scheduled notifications are updated,
 * or when the app starts.
 */
export async function scheduleAllScheduledNotifications(): Promise<void> {
  // Cancel all previously scheduled notifications with our prefix
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of allScheduled) {
    if (notification.identifier.startsWith(SCHEDULED_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  // Get all enabled scheduled notifications from database
  const scheduledNotifications = getScheduledNotifications().filter(n => n.enabled);

  // Schedule each notification
  for (const notification of scheduledNotifications) {
    await scheduleNotificationForAllDays(notification);
  }
}

/**
 * Schedule a single notification for all its configured days of the week.
 */
async function scheduleNotificationForAllDays(notification: ScheduledNotification): Promise<void> {
  if (!notification.id) return;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Schedule for each day of the week that's configured
  for (const dayOfWeek of notification.daysOfWeek) {
    // Calculate how many days until this day of week
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0) {
      daysUntil += 7;
    } else if (daysUntil === 0) {
      // Today - check if time has passed
      if (
        notification.hour < currentHour ||
        (notification.hour === currentHour && notification.minute <= currentMinute)
      ) {
        // Time has passed today, schedule for next week
        daysUntil = 7;
      }
    }

    const triggerDate = new Date();
    triggerDate.setDate(triggerDate.getDate() + daysUntil);
    triggerDate.setHours(notification.hour, notification.minute, 0, 0);

    const identifier = `${SCHEDULED_NOTIFICATION_PREFIX}${notification.id}_${dayOfWeek}`;

    // Create notification content
    const title = notification.label || t('notif_scheduled_title');
    const body = t('notif_scheduled_body');

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        categoryIdentifier: 'scheduled_reminder',
        data: {
          scheduledNotificationId: notification.id,
          dayOfWeek,
          isScheduled: true,
        },
        color: '#4A7C59',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        repeats: true,
        weekday: dayOfWeek + 1, // expo-notifications uses 1-7 (Sunday = 1)
        hour: notification.hour,
        minute: notification.minute,
        channelId: SCHEDULED_CHANNEL_ID,
      },
    });
  }
}

/**
 * Check if there's a scheduled notification within the given time window (in minutes).
 * This is used to prevent automatic reminders from conflicting with scheduled ones.
 */
export function hasScheduledNotificationNearby(windowMinutes: number = 60): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const scheduledNotifications = getScheduledNotifications().filter(n => n.enabled);

  for (const notification of scheduledNotifications) {
    // Check if this notification is scheduled for today
    if (!notification.daysOfWeek.includes(currentDay)) {
      continue;
    }

    const notifTimeMinutes = notification.hour * 60 + notification.minute;
    const timeDiff = Math.abs(notifTimeMinutes - currentTimeMinutes);

    if (timeDiff <= windowMinutes) {
      return true;
    }
  }

  return false;
}

/**
 * Get the next scheduled notification time.
 * Returns null if there are no scheduled notifications.
 */
export function getNextScheduledNotificationTime(): Date | null {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const scheduledNotifications = getScheduledNotifications().filter(n => n.enabled);
  if (scheduledNotifications.length === 0) {
    return null;
  }

  let nextDate: Date | null = null;

  for (const notification of scheduledNotifications) {
    for (const dayOfWeek of notification.daysOfWeek) {
      let daysUntil = dayOfWeek - currentDay;
      if (daysUntil < 0) {
        daysUntil += 7;
      } else if (daysUntil === 0) {
        // Today - check if time has passed
        if (
          notification.hour < currentHour ||
          (notification.hour === currentHour && notification.minute <= currentMinute)
        ) {
          daysUntil = 7;
        }
      }

      const candidateDate = new Date();
      candidateDate.setDate(candidateDate.getDate() + daysUntil);
      candidateDate.setHours(notification.hour, notification.minute, 0, 0);

      if (!nextDate || candidateDate < nextDate) {
        nextDate = candidateDate;
      }
    }
  }

  return nextDate;
}
