import * as Notifications from 'expo-notifications';
import {
  getTodayMinutesAsync,
  getCurrentDailyGoalAsync,
  insertReminderFeedbackAsync,
} from '../../storage';
import { triggerReminderFeedbackModal } from '../../store/useAppStore';
import { reminderMessageBuilder } from './ReminderMessageBuilder';
import {
  ACTION_WENT_OUTSIDE,
  ACTION_SNOOZE,
  ACTION_LESS_OFTEN,
  CHANNEL_ID,
  DAILY_PLANNER_NOTIF_PREFIX,
} from './NotificationInfrastructureService';

const SNOOZE_DURATION_MINUTES = 30;

export class NotificationResponseHandler {
  public async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const actionId = response.actionIdentifier;
    const notificationId = response.notification.request.identifier;
    const now = Date.now();
    const d = new Date(now);

    try {
      await Notifications.dismissNotificationAsync(notificationId);
    } catch (e) {
      console.warn('TouchGrass: Failed to dismiss notification:', e);
    }

    if (notificationId.startsWith(DAILY_PLANNER_NOTIF_PREFIX)) {
      return;
    }

    const action =
      actionId === ACTION_WENT_OUTSIDE
        ? 'went_outside'
        : actionId === ACTION_SNOOZE
          ? 'snoozed'
          : actionId === ACTION_LESS_OFTEN
            ? 'less_often'
            : 'dismissed';

    if (action !== 'less_often') {
      await insertReminderFeedbackAsync({
        timestamp: now,
        action,
        scheduledHour: d.getHours(),
        scheduledMinute: d.getMinutes() >= 30 ? 30 : 0,
        dayOfWeek: d.getDay(),
      });
    }

    if (action !== 'dismissed') {
      const confirmBodyKey =
        action === 'went_outside'
          ? 'notif_confirm_went_outside'
          : action === 'snoozed'
            ? 'notif_confirm_snoozed'
            : undefined;

      triggerReminderFeedbackModal({
        action,
        hour: d.getHours(),
        minute: d.getMinutes(),
        ...(confirmBodyKey ? { confirmBodyKey } : {}),
      });
    }

    if (action === 'snoozed') {
      const snoozeDate = new Date(now + SNOOZE_DURATION_MINUTES * 60 * 1000);
      const snoozeHour = snoozeDate.getHours();
      const { title, body } = await reminderMessageBuilder.buildReminderMessage(
        await getTodayMinutesAsync(),
        (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30,
        snoozeHour,
        undefined,
        false
      );
      await Notifications.scheduleNotificationAsync({
        content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: SNOOZE_DURATION_MINUTES * 60,
          channelId: CHANNEL_ID,
        },
      });
    }
  }
}

export const notificationResponseHandler = new NotificationResponseHandler();
