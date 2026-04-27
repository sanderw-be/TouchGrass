import { InteractionManager } from 'react-native';
import { initDatabaseAsync, getSettingAsync, setSettingAsync, db } from './src/storage';
import { createContainer } from './src/core/container';
import i18n, { getDeviceSupportedLocale, SUPPORTED_LOCALES } from './src/i18n';
import {
  getNotificationInfrastructureService,
  getSmartReminderScheduler,
  getScheduledNotificationManager,
  getNotificationResponseHandler,
} from './src/notifications/notificationManager';
import { initDetection } from './src/detection/index';
import { requestWidgetRefresh } from './src/utils/widgetHelper';
import { refreshBatteryOptimizationSetting } from './src/utils/batteryOptimization';
import type { FeedbackModalData } from './src/store/useAppStore';

export interface CriticalAppState {
  showIntro: boolean;
  initialLocale: string;
}

/**
 * Performs critical-path initialization asynchronously: database and language settings.
 */
export async function performCriticalInitializationAsync(
  onFeedbackTriggered: (data: FeedbackModalData) => void
): Promise<CriticalAppState> {
  // Database must be ready before anything else
  await initDatabaseAsync();

  // Initialize IoC Container
  createContainer(db, onFeedbackTriggered);

  // Apply stored language preference if available
  const storedLanguage = await getSettingAsync('language', 'system');
  let initialLocale: string;

  if (storedLanguage === 'system') {
    i18n.locale = getDeviceSupportedLocale();
    initialLocale = 'system';
  } else if (SUPPORTED_LOCALES.includes(storedLanguage as (typeof SUPPORTED_LOCALES)[number])) {
    i18n.locale = storedLanguage;
    initialLocale = storedLanguage;
  } else {
    i18n.locale = 'en';
    initialLocale = 'en';
    await setSettingAsync('language', 'en');
  }

  // Check if user has completed intro
  const hasCompletedIntro = (await getSettingAsync('hasCompletedIntro', '0')) === '1';

  return {
    showIntro: !hasCompletedIntro,
    initialLocale,
  };
}

/**
 * Performs non-critical initialization that can be deferred until after the
 * first interactive render.
 */
export function performDeferredInitialization(): void {
  InteractionManager.runAfterInteractions(() => {
    console.log('TouchGrass: Starting deferred initialization...');

    const deferredTasks = async () => {
      // This was a separate useEffect, but it can be part of the deferred group.
      try {
        await refreshBatteryOptimizationSetting();
      } catch (e) {
        console.warn('Battery optimization status check error:', e);
      }

      // Grouped async calls
      const tasks = [
        {
          name: 'Notification Infrastructure',
          task: () =>
            getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
              getNotificationResponseHandler().handleNotificationResponse(response)
            ),
        },
        { name: 'Detection Initialization', task: initDetection },
        { name: 'Day Reminders', task: () => getSmartReminderScheduler().scheduleDayReminders() },
        {
          name: 'Scheduled Notifications',
          task: () => getScheduledNotificationManager().scheduleAllScheduledNotifications(),
        },
        { name: 'Initial Widget Refresh', task: requestWidgetRefresh },
      ];

      for (const { name, task } of tasks) {
        try {
          await task();
        } catch (e) {
          console.warn(`TouchGrass: Deferred init task '${name}' failed:`, e);
        }
      }
    };

    deferredTasks().then(() => {
      console.log('TouchGrass: Deferred initialization complete.');
    });
  });
}
