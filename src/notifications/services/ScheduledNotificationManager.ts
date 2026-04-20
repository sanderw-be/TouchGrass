import * as Notifications from 'expo-notifications';
import { getScheduledNotificationsAsync } from '../../storage';
import { t } from '../../i18n';

export const SCHEDULED_NOTIF_PREFIX = 'scheduled_';
const MINUTES_IN_DAY = 24 * 60;

export class ScheduledNotificationManager {
  public async scheduleAllScheduledNotifications(): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn(
          'TouchGrass: Cannot schedule notifications - permission not granted. Current status:',
          status
        );
        return;
      }

      const schedules = await getScheduledNotificationsAsync();
      const enabled = schedules.filter((s) => s.enabled === 1);

      console.log(`TouchGrass: Scheduling ${enabled.length} enabled notification schedule(s)`);

      try {
        await this.cancelAllScheduledNotifications();
      } catch (error) {
        console.error('TouchGrass: Error canceling existing notifications:', error);
      }

      let totalScheduled = 0;
      const errors: string[] = [];

      for (const schedule of enabled) {
        if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
          console.warn(`TouchGrass: Schedule ${schedule.id} has no valid days of week, skipping`);
          continue;
        }

        for (const dayOfWeek of schedule.daysOfWeek) {
          const notificationId = `${SCHEDULED_NOTIF_PREFIX}${schedule.id}_${dayOfWeek}`;

          try {
            await Notifications.scheduleNotificationAsync({
              identifier: notificationId,
              content: {
                title: schedule.label || t('notif_title_1'),
                body: t('scheduled_notif_body'),
                sound: true,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: dayOfWeek + 1,
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
      }
    } catch (error) {
      console.error('TouchGrass: Error in scheduleAllScheduledNotifications:', error);
    }
  }

  public async cancelAllScheduledNotifications(): Promise<void> {
    const all = await Notifications.getAllScheduledNotificationsAsync();

    for (const notif of all) {
      if (notif.identifier.startsWith(SCHEDULED_NOTIF_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }

  public async isSlotNearScheduledNotification(
    slotHour: number,
    slotMinute: number,
    windowMinutes: number
  ): Promise<boolean> {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const slotMinutesOfDay = slotHour * 60 + slotMinute;

    const schedules = await getScheduledNotificationsAsync();
    const enabled = schedules.filter((s) => s.enabled === 1);

    for (const schedule of enabled) {
      if (!schedule.daysOfWeek.includes(todayDayOfWeek)) continue;

      const scheduledMinutesOfDay = schedule.hour * 60 + schedule.minute;
      const diff = Math.abs(slotMinutesOfDay - scheduledMinutesOfDay);

      if (diff <= windowMinutes || diff >= MINUTES_IN_DAY - windowMinutes) {
        return true;
      }
    }

    return false;
  }

  public async hasScheduledNotificationNearby(windowMinutes: number): Promise<boolean> {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const schedules = await getScheduledNotificationsAsync();
    const enabled = schedules.filter((s) => s.enabled === 1);

    for (const schedule of enabled) {
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      const scheduledMinutes = schedule.hour * 60 + schedule.minute;
      const diff = Math.abs(currentMinutes - scheduledMinutes);

      if (diff <= windowMinutes || diff >= 24 * 60 - windowMinutes) {
        return true;
      }
    }

    return false;
  }
}

export const scheduledNotificationManager = new ScheduledNotificationManager();
