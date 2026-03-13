import * as Notifications from 'expo-notifications';
import { getScheduledNotifications } from '../storage/database';
import { t } from '../i18n';

// Prefix for scheduled notification identifiers
const SCHEDULED_NOTIF_PREFIX = 'scheduled_';
const MINUTES_IN_DAY = 24 * 60;

/**
 * Schedule all enabled scheduled notifications using WEEKLY triggers.
 * WEEKLY triggers auto-repeat every week and use Android's AlarmManager directly,
 * which avoids the WorkManager serialization issue (NotSerializableException).
 * This function does not throw errors to avoid crashing the app.
 */
export async function scheduleAllScheduledNotifications(): Promise<void> {
  try {
    // Check if we have notification permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('TouchGrass: Cannot schedule notifications - permission not granted. Current status:', status);
      return; // Don't throw, just return
    }

    const schedules = getScheduledNotifications();
    const enabled = schedules.filter(s => s.enabled === 1);
    
    console.log(`TouchGrass: Scheduling ${enabled.length} enabled notification schedule(s)`);

    // Cancel existing scheduled notifications (prefix-based)
    try {
      await cancelAllScheduledNotifications();
    } catch (error) {
      console.error('TouchGrass: Error canceling existing notifications:', error);
      // Continue anyway
    }

    let totalScheduled = 0;
    const errors: string[] = [];
    
    for (const schedule of enabled) {
      // Validate schedule data before processing
      if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
        console.warn(`TouchGrass: Schedule ${schedule.id} has no valid days of week, skipping`);
        continue;
      }
      
      for (const dayOfWeek of schedule.daysOfWeek) {
        // Schedule a notification for the next occurrence of this day/time
        const notificationId = `${SCHEDULED_NOTIF_PREFIX}${schedule.id}_${dayOfWeek}`;
        
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: schedule.label || t('notif_title_1'),
              body: t('scheduled_notif_body'),
              sound: true,
              // Note: 'data' is intentionally omitted. Passing a 'data' object causes
              // NotificationContent.mBody to be a JSONObject. On Android, R8/ProGuard can
              // strip the private writeObject() method despite the keep rule, falling back to
              // default Java serialization which cannot serialize JSONObject → NotSerializableException.
              // WEEKLY triggers auto-repeat so there is no rescheduling logic that would need metadata.
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: dayOfWeek + 1, // expo-notifications uses 1-7 (1=Sunday), JS Date uses 0-6 (0=Sunday)
              hour: schedule.hour,
              minute: schedule.minute,
              channelId: 'touchgrass_scheduled',
            },
          });
          totalScheduled++;
        } catch (error) {
          const errorMsg = `Failed to schedule ${notificationId}: ${error}`;
          console.error(`TouchGrass: ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }
    
    console.log(`TouchGrass: Successfully scheduled ${totalScheduled} notifications`);
    
    if (errors.length > 0) {
      console.error(`TouchGrass: Encountered ${errors.length} error(s) during scheduling`);
      // Don't throw, just log the errors
    }
  } catch (error) {
    console.error('TouchGrass: Error in scheduleAllScheduledNotifications:', error);
    // Don't throw to avoid crashing the app
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
 * Check if a candidate slot (hour, minute) is within the given window (in minutes)
 * of any user-defined scheduled notification that applies to today.
 *
 * @param slotHour - The hour of the candidate slot (0-23)
 * @param slotMinute - The minute of the candidate slot (0 or 30)
 * @param windowMinutes - How many minutes before/after to consider "nearby"
 * @returns true if the slot is near a scheduled notification for today
 */
export function isSlotNearScheduledNotification(
  slotHour: number,
  slotMinute: number,
  windowMinutes: number,
): boolean {
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday
  const slotMinutesOfDay = slotHour * 60 + slotMinute;

  const schedules = getScheduledNotifications();
  const enabled = schedules.filter(s => s.enabled === 1);

  for (const schedule of enabled) {
    if (!schedule.daysOfWeek.includes(todayDayOfWeek)) continue;

    const scheduledMinutesOfDay = schedule.hour * 60 + schedule.minute;
    const diff = Math.abs(slotMinutesOfDay - scheduledMinutesOfDay);

    if (diff <= windowMinutes || diff >= (MINUTES_IN_DAY - windowMinutes)) {
      // Second condition handles day-boundary wraparound (e.g. slot at 23:30 near a notification at 00:10)
      return true;
    }
  }

  return false;
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
