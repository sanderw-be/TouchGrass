import { InteractionManager } from 'react-native';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n, { getDeviceSupportedLocale, SUPPORTED_LOCALES } from './src/i18n';
import {
  setupNotificationInfrastructure,
  scheduleDayReminders,
} from './src/notifications/notificationManager';
import { registerUnifiedBackgroundTask } from './src/background/unifiedBackgroundTask';
import { scheduleNextAlarmPulse } from './src/background/alarmTiming';
import { initDetection } from './src/detection/index';
import { requestWidgetRefresh } from './src/utils/widgetHelper';
import { refreshBatteryOptimizationSetting } from './src/utils/batteryOptimization';

export interface CriticalAppState {
  showIntro: boolean;
  initialLocale: string;
}

/**
 * Performs critical-path initialization: database and language settings.
 * This must complete before the first render. It is synchronous.
 */
export function performCriticalInitialization(): CriticalAppState {
  // Database must be ready before anything else
  initDatabase();

  // Apply stored language preference if available
  const storedLanguage = getSetting('language', 'system');
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
    setSetting('language', 'en');
  }

  // Check if user has completed intro
  const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';

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
        { name: 'Notification Infrastructure', task: setupNotificationInfrastructure },
        { name: 'Detection Initialization', task: initDetection },
        { name: 'Day Reminders', task: scheduleDayReminders },
        {
          name: 'Scheduled Notifications',
          task: async () => {
            const { scheduleAllScheduledNotifications } =
              await import('./src/notifications/scheduledNotifications');
            await scheduleAllScheduledNotifications();
          },
        },
        { name: 'Unified Background Task', task: registerUnifiedBackgroundTask },
        { name: 'Alarm Pulse Chain', task: scheduleNextAlarmPulse },
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
