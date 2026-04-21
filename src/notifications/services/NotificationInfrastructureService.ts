import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '../../i18n';

export const ACTION_WENT_OUTSIDE = 'went_outside';
export const ACTION_SNOOZE = 'snoozed';
export const ACTION_LESS_OFTEN = 'less_often';

export const CHANNEL_ID = 'touchgrass_reminders';
export const DEFAULT_ANDROID_CHANNEL_ID = 'default';
export const DAILY_PLANNER_CHANNEL_ID = 'touchgrass_daily_planner';
export const DAILY_PLANNER_NOTIF_PREFIX = 'daily_planner_';

export interface INotificationInfrastructureService {
  setupNotificationInfrastructure(
    handleResponse: (response: Notifications.NotificationResponse) => void
  ): Promise<void>;
  requestNotificationPermissions(): Promise<boolean>;
  createReminderChannels(): Promise<void>;
}

export class NotificationInfrastructureService implements INotificationInfrastructureService {
  public async createReminderChannels(): Promise<void> {
    const reminderChannelConfig = {
      name: t('notif_channel_name'),
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A7C59',
      showBadge: true,
    };

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, reminderChannelConfig);
    await Notifications.setNotificationChannelAsync(
      DEFAULT_ANDROID_CHANNEL_ID,
      reminderChannelConfig
    );
  }

  /**
   * Set up notification infrastructure without requesting permissions.
   * Call once on app start.
   */
  public async setupNotificationInfrastructure(
    handleResponse: (response: Notifications.NotificationResponse) => void
  ): Promise<void> {
    // Android notification channels
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('touchgrass_background', {
          name: t('notif_channel_background_name'),
          description: t('notif_channel_background_desc'),
          importance: Notifications.AndroidImportance.MIN,
          showBadge: false,
          enableVibrate: false,
        });
        console.log('TouchGrass: Background notification channel created');
      } catch (e) {
        console.warn('TouchGrass: Failed to create background channel:', e);
      }

      try {
        await Notifications.setNotificationChannelAsync('touchgrass_scheduled', {
          name: t('notif_channel_scheduled_name'),
          description: t('notif_channel_scheduled_desc'),
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4A7C59',
          showBadge: true,
        });
        console.log('TouchGrass: Scheduled notification channel created');
      } catch (e) {
        console.warn('TouchGrass: Failed to create scheduled channel:', e);
      }

      try {
        await this.createReminderChannels();
        console.log('TouchGrass: Reminder notification channels created');
      } catch (e) {
        console.warn('TouchGrass: Failed to create reminder channels:', e);
      }

      try {
        await Notifications.setNotificationChannelAsync(DAILY_PLANNER_CHANNEL_ID, {
          name: t('notif_channel_daily_planner_name'),
          description: t('notif_channel_daily_planner_desc'),
          importance: Notifications.AndroidImportance.MIN,
          showBadge: false,
          enableVibrate: false,
        });
        console.log('TouchGrass: Daily planner notification channel created');
      } catch (e) {
        console.warn('TouchGrass: Failed to create daily planner channel:', e);
      }
    }

    try {
      await Notifications.setNotificationCategoryAsync('reminder', [
        {
          identifier: ACTION_WENT_OUTSIDE,
          buttonTitle: t('notif_action_went_outside'),
          options: { opensAppToForeground: true },
        },
        {
          identifier: ACTION_SNOOZE,
          buttonTitle: t('notif_action_snooze'),
          options: { opensAppToForeground: true },
        },
        {
          identifier: ACTION_LESS_OFTEN,
          buttonTitle: t('notif_action_less_often'),
          options: { opensAppToForeground: true },
        },
      ]);
    } catch (e) {
      console.warn('TouchGrass: Failed to register notification categories:', e);
    }

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isDailyPlanner = notification.request.identifier.startsWith(
          DAILY_PLANNER_NOTIF_PREFIX
        );
        return {
          shouldShowAlert: !isDailyPlanner,
          shouldPlaySound: !isDailyPlanner,
          shouldSetBadge: false,
          shouldShowBanner: !isDailyPlanner,
          shouldShowList: !isDailyPlanner,
        };
      },
    });

    Notifications.addNotificationResponseReceivedListener(handleResponse);
  }

  /**
   * Request notification permissions and complete setup.
   * Returns true if permissions were granted.
   */
  public async requestNotificationPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('TouchGrass: Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await this.createReminderChannels();
    }

    await Notifications.setNotificationCategoryAsync('reminder', [
      {
        identifier: ACTION_WENT_OUTSIDE,
        buttonTitle: t('notif_action_went_outside'),
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: t('notif_action_snooze'),
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_LESS_OFTEN,
        buttonTitle: t('notif_action_less_often'),
        options: { opensAppToForeground: true },
      },
    ]);

    return true;
  }
}
