import * as Notifications from 'expo-notifications';
import { getScheduledNotifications } from '../storage/database';

// Prefix for scheduled notification identifiers
const SCHEDULED_NOTIF_PREFIX = 'scheduled_';

/**
 * Calculate the next occurrence of a scheduled notification.
 * @param hour - Hour of day (0-23)
 * @param minute - Minute of hour (0-59)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @returns Date object for the next occurrence
 */
function getNextOccurrence(hour: number, minute: number, dayOfWeek: number): Date {
  // Validate inputs
  if (isNaN(hour) || isNaN(minute) || isNaN(dayOfWeek)) {
    console.error(`Invalid input to getNextOccurrence: hour=${hour}, minute=${minute}, dayOfWeek=${dayOfWeek}`);
    throw new Error(`Invalid schedule data: hour=${hour}, minute=${minute}, dayOfWeek=${dayOfWeek}`);
  }
  
  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be 0-23`);
  }
  
  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be 0-59`);
  }
  
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(`Invalid dayOfWeek: ${dayOfWeek}. Must be 0-6`);
  }
  
  const now = new Date();
  const targetDate = new Date();
  
  // Set the target time
  targetDate.setHours(hour, minute, 0, 0);
  
  // Calculate days until target day of week
  const currentDay = now.getDay();
  let daysUntilTarget = dayOfWeek - currentDay;
  
  // If target day is today but time has passed, or target day is earlier in week, go to next week
  if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now >= targetDate)) {
    daysUntilTarget += 7;
  }
  
  // Add the days to reach target day
  targetDate.setDate(targetDate.getDate() + daysUntilTarget);
  
  return targetDate;
}

/**
 * Schedule all enabled scheduled notifications using DATE triggers.
 * Uses DATE triggers instead of CALENDAR for better Android compatibility.
 */
export async function scheduleAllScheduledNotifications(): Promise<void> {
  try {
    // Check if we have notification permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Cannot schedule notifications: Permission not granted. Current status:', status);
      throw new Error('Notification permissions not granted');
    }

    const schedules = getScheduledNotifications();
    const enabled = schedules.filter(s => s.enabled === 1);

    console.log(`Preparing to schedule notifications for ${enabled.length} enabled schedules...`);

    // Cancel existing scheduled notifications (prefix-based)
    await cancelAllScheduledNotifications();

    let totalScheduled = 0;
    const errors: string[] = [];
    
    for (const schedule of enabled) {
      // Validate schedule data before processing
      if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
        console.error(`Schedule ${schedule.id} has no valid days of week:`, schedule);
        continue;
      }
      
      console.log(`Processing schedule ${schedule.id}: hour=${schedule.hour}, minute=${schedule.minute}, days=[${schedule.daysOfWeek.join(', ')}]`);
      
      for (const dayOfWeek of schedule.daysOfWeek) {
        // Schedule a notification for the next occurrence of this day/time
        const notificationId = `${SCHEDULED_NOTIF_PREFIX}${schedule.id}_${dayOfWeek}`;
        
        try {
          // Calculate next occurrence
          const nextOccurrence = getNextOccurrence(schedule.hour, schedule.minute, dayOfWeek);
          
          const result = await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: schedule.label || '🌿 Time to touch grass!',
              body: 'Your scheduled reminder to go outside.',
              sound: true,
              color: '#4A7C59',
              data: {
                scheduleId: schedule.id,
                dayOfWeek,
                hour: schedule.hour,
                minute: schedule.minute,
                isScheduledNotification: true,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextOccurrence.getTime(), // Use timestamp (milliseconds) for better cross-platform compatibility
              channelId: 'touchgrass_scheduled',
            },
          });
          totalScheduled++;
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          console.log(`✓ Scheduled notification ${notificationId} for ${dayNames[dayOfWeek]} at ${schedule.hour}:${String(schedule.minute).padStart(2, '0')} - Next: ${nextOccurrence.toLocaleString()} - Result: ${result}`);
        } catch (error) {
          const errorMsg = `Failed to schedule ${notificationId}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`Successfully scheduled ${totalScheduled} notifications from ${enabled.length} schedules`);
    
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors during scheduling:`, errors);
    }

    // Verify what got scheduled
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = allScheduled.filter(n => n.identifier.startsWith(SCHEDULED_NOTIF_PREFIX));
    console.log(`Verification: Found ${ourNotifications.length} scheduled notifications in system`);
    
    if (ourNotifications.length > 0) {
      console.log('Scheduled notifications:', ourNotifications.map(n => ({
        id: n.identifier,
        trigger: n.trigger,
      })));
    }
  } catch (error) {
    console.error('Error in scheduleAllScheduledNotifications:', error);
    throw error;
  }
}

/**
 * Reschedule a single notification for next week.
 * Called when a scheduled notification fires.
 */
export async function rescheduleNotificationForNextWeek(
  scheduleId: number,
  dayOfWeek: number,
  hour: number,
  minute: number
): Promise<void> {
  try {
    const notificationId = `${SCHEDULED_NOTIF_PREFIX}${scheduleId}_${dayOfWeek}`;
    
    // Calculate next occurrence (will be 7 days from now since we just fired)
    const nextOccurrence = getNextOccurrence(hour, minute, dayOfWeek);
    
    console.log(`Rescheduling ${notificationId} for ${nextOccurrence.toLocaleString()}`);
    
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: '🌿 Time to touch grass!',
        body: 'Your scheduled reminder to go outside.',
        sound: true,
        color: '#4A7C59',
        data: {
          scheduleId,
          dayOfWeek,
          hour,
          minute,
          isScheduledNotification: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextOccurrence.getTime(), // Use timestamp for better cross-platform compatibility
        channelId: 'touchgrass_scheduled',
      },
    });
  } catch (error) {
    console.error(`Failed to reschedule notification:`, error);
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
