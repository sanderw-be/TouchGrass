import * as Notifications from 'expo-notifications';
import { IStorageService } from '../../storage/StorageService';
import { IReminderMessageBuilder } from './ReminderMessageBuilder';
import { useAppStore } from '../../store/useAppStore';
import {
  ACTION_WENT_OUTSIDE,
  ACTION_SNOOZE,
  ACTION_LESS_OFTEN,
  CHANNEL_ID,
  DAILY_PLANNER_NOTIF_PREFIX,
} from './NotificationInfrastructureService';
import { colors } from '../../utils/theme';

const SNOOZE_DURATION_MINUTES = 30;

export interface INotificationResponseHandler {
  handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void>;
}

export class NotificationResponseHandler implements INotificationResponseHandler {
  constructor(
    private storageService: IStorageService,
    private messageBuilder: IReminderMessageBuilder
  ) {}

  public async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const actionId = response.actionIdentifier;
    const notificationId = response.notification.request.identifier;
    console.log(`[NOTIF_RESPONSE] Action: ${actionId}, NotifID: ${notificationId}`);
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

    // --- DWELL PROMPT HANDLING ---
    const notifData = response.notification?.request?.content?.data;
    if (notifData?.type === 'dwell_prompt') {
      const { navigate } = await import('../../navigation/navigationRef');

      // Explicitly dismiss this notification just in case the top-level dismiss didn't catch it
      // or if it was using the constant ID instead of the dynamic instance ID.
      try {
        await Notifications.dismissNotificationAsync(notificationId);
        const { DWELL_NOTIFICATION_ID } = await import('../../detection/constants');
        await Notifications.dismissNotificationAsync(DWELL_NOTIFICATION_ID);
      } catch (e) {
        // Best effort
      }

      // Navigate to Settings tab -> KnownLocations screen with create action
      navigate('Settings', {
        screen: 'KnownLocations',
        params: { action: 'create' },
      });
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
      await this.storageService.insertReminderFeedbackAsync({
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

      console.log(`[NOTIF_RESPONSE] Triggering UI feedback for action: ${action}`);
      useAppStore.getState().triggerFeedback({
        action,
        hour: d.getHours(),
        minute: d.getMinutes(),
        ...(confirmBodyKey ? { confirmBodyKey } : {}),
      });
    }

    if (action === 'snoozed') {
      const snoozeDate = new Date(now + SNOOZE_DURATION_MINUTES * 60 * 1000);
      const snoozeHour = snoozeDate.getHours();

      const todayMinutes = await this.storageService.getTodayMinutesAsync();
      const goal = await this.storageService.getCurrentDailyGoalAsync();
      const targetMinutes = goal?.targetMinutes ?? 30;

      const { title, body } = await this.messageBuilder.buildReminderMessage(
        todayMinutes,
        targetMinutes,
        snoozeHour,
        undefined
      );

      await Notifications.scheduleNotificationAsync({
        content: { title, body, categoryIdentifier: 'reminder', color: colors.grass },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: SNOOZE_DURATION_MINUTES * 60,
          channelId: CHANNEL_ID,
        },
      });
    }
  }
}
