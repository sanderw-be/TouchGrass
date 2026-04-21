import * as Notifications from 'expo-notifications';
import { IStorageService } from '../../storage/StorageService';
import { t } from '../../i18n';

export const SCHEDULED_NOTIF_PREFIX = 'scheduled_';

export interface IScheduledNotificationManager {
  scheduleAllScheduledNotifications(): Promise<void>;
  hasScheduledNotificationNearby(thresholdMinutes: number): Promise<boolean>;
  isSlotNearScheduledNotification(
    hour: number,
    minute: number,
    thresholdMinutes: number
  ): Promise<boolean>;
}

export class ScheduledNotificationManager implements IScheduledNotificationManager {
  constructor(private storageService: IStorageService) {}

  public async hasScheduledNotificationNearby(thresholdMinutes: number): Promise<boolean> {
    const scheduled = await this.storageService.getScheduledNotificationsAsync();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const notif of scheduled) {
      if (!notif.enabled) continue;
      // Simplification: only checks for today's scheduled notifications
      if (notif.dayOfWeek === now.getDay()) {
        const notifMinutes = notif.hour * 60 + notif.minute;
        if (Math.abs(notifMinutes - nowMinutes) <= thresholdMinutes) {
          return true;
        }
      }
    }
    return false;
  }

  public async isSlotNearScheduledNotification(
    hour: number,
    minute: number,
    thresholdMinutes: number
  ): Promise<boolean> {
    const scheduled = await this.storageService.getScheduledNotificationsAsync();
    const slotMinutes = hour * 60 + minute;
    const now = new Date();

    for (const notif of scheduled) {
      if (!notif.enabled) continue;
      // Simplification: only checks for today's scheduled notifications
      if (notif.dayOfWeek === now.getDay()) {
        const notifMinutes = notif.hour * 60 + notif.minute;
        if (Math.abs(notifMinutes - slotMinutes) <= thresholdMinutes) {
          return true;
        }
      }
    }
    return false;
  }

  public async scheduleAllScheduledNotifications(): Promise<void> {
    const scheduled = await this.storageService.getScheduledNotificationsAsync();

    // Cancel all existing scheduled notifications
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of existing) {
      if (notif.identifier.startsWith(SCHEDULED_NOTIF_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    // Schedule each one
    for (const notif of scheduled) {
      if (notif.enabled) {
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: `${SCHEDULED_NOTIF_PREFIX}${notif.id}`,
            content: {
              title: t('notif_scheduled_title'),
              body: notif.message || t('notif_scheduled_body'),
              categoryIdentifier: 'reminder',
              color: '#4A7C59',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: notif.dayOfWeek + 1, // Expo uses 1-7 for Sunday-Saturday, but our DB stores 0-6 for Sunday-Saturday.
              // Wait, let's verify Expo weekday: 1 is Sunday, 2 is Monday... 7 is Saturday.
              // Our DB: 0 is Sunday, 1 is Monday... 6 is Saturday.
              // So +1 is correct.
              hour: notif.hour,
              minute: notif.minute,
            },
          });
        } catch (e) {
          console.error(`TouchGrass: Failed to schedule notification ${notif.id}:`, e);
        }
      }
    }
  }
}
