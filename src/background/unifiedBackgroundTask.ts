/**
 * Unified background task that merges reminder planning and weather refresh.
 * expo-background-task only allows ONE registered task per app, so all
 * background work is consolidated here.
 *
 * On each ~15-minute wake:
 * 1. If weather is enabled: fetchWeatherForecast first — populates the 30-min cache so
 *    the reminder functions below hit the cache instead of making their own network calls.
 * 2. If reminders are enabled: scheduleDayReminders → processReminderQueue → maybeScheduleCatchUpReminder
 *    Both internally call fetchWeatherForecast too, but they get an instant cache-hit
 *    because step 1 has already refreshed the data.
 */

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  processReminderQueue,
  logReminderQueueSnapshot,
} from '../notifications/notificationManager';
import { fetchWeatherForecast } from '../weather/weatherService';
import { getSetting, initDatabase } from '../storage/database';

export const UNIFIED_BACKGROUND_TASK = 'TOUCHGRASS_UNIFIED_TASK';

/**
 * Define the unified background task.
 * Must be called at module scope so TaskManager can register it before the
 * app JS bundle fully loads (required for background wake-ups).
 */
TaskManager.defineTask(UNIFIED_BACKGROUND_TASK, async () => {
  try {
    console.log('TouchGrass: [UnifiedTask] Tick');

    // Ensure the DB schema and default settings are in place.
    // The background JS runtime has no guarantee that App.tsx has run first.
    initDatabase();

    // --- Weather refresh (runs first to warm the 30-min cache) ---
    // scheduleDayReminders and maybeScheduleCatchUpReminder both call
    // fetchWeatherForecast internally. By fetching once up-front, those
    // internal calls return immediately from the cache instead of each
    // making their own location + HTTP round-trip. This keeps the total
    // task wall-time well within Android's background execution window.
    const weatherEnabled = getSetting('weather_enabled', '1') === '1';
    if (weatherEnabled) {
      try {
        await fetchWeatherForecast({ allowPermissionPrompt: false });
      } catch (weatherError) {
        console.error('TouchGrass: [UnifiedTask] Weather fetch failed', weatherError);
      }
    }

    // --- Reminder planning ---
    const remindersCountRaw = getSetting('smart_reminders_count', '0');
    const remindersEnabled = parseInt(remindersCountRaw, 10) > 0;
    console.log(
      `TouchGrass: [UnifiedTask] smart_reminders_count=${remindersCountRaw} → reminders ${remindersEnabled ? 'enabled' : 'disabled'}`
    );
    if (remindersEnabled) {
      logReminderQueueSnapshot();
      try {
        await scheduleDayReminders();
        await processReminderQueue(); // update consumed states before catch-up check
        await maybeScheduleCatchUpReminder(); // uses consumed entries for 60-min wait guard
      } catch (reminderError) {
        console.error('TouchGrass: [UnifiedTask] Reminder operations failed', reminderError);
      }
    }

    console.log('TouchGrass: [UnifiedTask] Tick done');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('TouchGrass: [UnifiedTask] Fatal error', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the unified background task with WorkManager / BGTaskScheduler.
 * Safe to call multiple times — checks for existing registration first.
 */
export async function registerUnifiedBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(UNIFIED_BACKGROUND_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(UNIFIED_BACKGROUND_TASK, {
        minimumInterval: 15, // 15 minutes
      });
      console.log('TouchGrass: [UnifiedTask] Registered');
    }
  } catch (error) {
    console.error('TouchGrass: [UnifiedTask] Failed to register', error);
  }
}

/**
 * Unregister the unified background task.
 * Useful for testing or when all background work is disabled by the user.
 */
export async function unregisterUnifiedBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(UNIFIED_BACKGROUND_TASK);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(UNIFIED_BACKGROUND_TASK);
      console.log('TouchGrass: [UnifiedTask] Unregistered');
    }
  } catch (error) {
    console.error('TouchGrass: [UnifiedTask] Failed to unregister', error);
  }
}
