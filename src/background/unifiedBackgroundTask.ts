import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { scheduleNextPulse, cancelPulse } from 'alarm-bridge-native';
import { NotificationService } from '../notifications/notificationManager';
import { fetchWeatherForecast } from '../weather/weatherService';
import { getSettingAsync, initDatabaseAsync, insertBackgroundLogAsync } from '../storage/database';

export const UNIFIED_BACKGROUND_TASK = 'TOUCHGRASS_UNIFIED_TASK';

/** Alarm interval during active hours (06:00 – 00:00). */
export const PULSE_INTERVAL_DAY_MS = 15 * 60 * 1000;

/** Alarm interval during overnight quiet hours (00:00 – 06:00). */
export const PULSE_INTERVAL_NIGHT_MS = 60 * 60 * 1000;

class BackgroundServiceImpl {
  private tickInProgress = false;

  /**
   * Compute the delay until the next alarm pulse based on the current time.
   */
  public computeNextSleepMs(now: Date = new Date()): number {
    const hour = now.getHours();
    return hour >= 0 && hour < 6 ? PULSE_INTERVAL_NIGHT_MS : PULSE_INTERVAL_DAY_MS;
  }

  /**
   * Schedule the next alarm pulse.
   * Idempotent — FLAG_UPDATE_CURRENT replaces any existing alarm.
   */
  public async scheduleNextAlarmPulse(now?: Date): Promise<void> {
    const delayMs = this.computeNextSleepMs(now);
    await scheduleNextPulse(delayMs);
  }

  /** Cancel the pending alarm pulse. */
  public async cancelAlarmPulse(): Promise<void> {
    await cancelPulse();
  }

  /**
   * Perform one background tick: weather refresh (optional) + reminder planning.
   */
  public async performBackgroundTick(): Promise<void> {
    if (this.tickInProgress) {
      console.log('TouchGrass: [BackgroundTick] Already running — skipping concurrent tick');
      await insertBackgroundLogAsync('reminder', 'Background tick skipped — already running');
      return;
    }
    this.tickInProgress = true;

    try {
      // Step 1: Initialize Database (Fatal if fails)
      await initDatabaseAsync();
      await insertBackgroundLogAsync('reminder', 'Background tick start');

      // Step 2: Sync Modules (Isolated)
      let weatherSyncSuccess = true;
      let reminderSyncSuccess = true;

      try {
        await this.handleWeatherSync();
      } catch (e) {
        console.error('TouchGrass: [BackgroundTick] Weather sync failed', e);
        await insertBackgroundLogAsync('reminder', 'Weather refresh failed');
        weatherSyncSuccess = false;
      }

      try {
        await this.handleReminderSync();
      } catch (e) {
        console.error('TouchGrass: [BackgroundTick] Reminder sync failed', e);
        reminderSyncSuccess = false;
      }

      // Step 3: Final Status Check
      if (!weatherSyncSuccess && !reminderSyncSuccess) {
        // Only throw if NO module succeeded. This fulfills the isolation requirement.
        throw new Error('All background sync modules failed');
      }

      await insertBackgroundLogAsync('reminder', 'Background tick done');
    } catch (fatalError) {
      console.error('TouchGrass: [BackgroundTick] Error during tick', fatalError);
      // Propagate original fatal errors (e.g. "DB exploded") or the collective failure.
      throw fatalError;
    } finally {
      this.tickInProgress = false;
    }
  }

  /**
   * Private helper to handle weather forecast refresh.
   */
  private async handleWeatherSync(): Promise<void> {
    const weatherEnabled = (await getSettingAsync('weather_enabled', '1')) === '1';
    if (weatherEnabled) {
      try {
        await fetchWeatherForecast({ allowPermissionPrompt: false });
        await insertBackgroundLogAsync('reminder', 'Weather refresh succeeded');
      } catch (weatherError) {
        console.error('TouchGrass: [BackgroundTick] Weather fetch failed', weatherError);
        throw weatherError; // Re-throw to be caught by the isolated try/catch in orchestrator
      }
    } else {
      await insertBackgroundLogAsync('reminder', 'Weather disabled — skipping refresh');
    }
  }

  /**
   * Private helper to handle reminder planning and processing.
   */
  private async handleReminderSync(): Promise<void> {
    const remindersCountRaw = await getSettingAsync('smart_reminders_count', '0');
    const remindersEnabled = parseInt(remindersCountRaw, 10) > 0;

    console.log(
      `TouchGrass: [BackgroundTick] smart_reminders_count=${remindersCountRaw} → reminders ${remindersEnabled ? 'enabled' : 'disabled'}`
    );

    if (remindersEnabled) {
      await NotificationService.logReminderQueueSnapshot();
      try {
        await NotificationService.scheduleDayReminders();
        await NotificationService.processReminderQueue();
        await NotificationService.updateUpcomingReminderContent();
        await NotificationService.maybeScheduleCatchUpReminder();
      } catch (reminderError) {
        console.error('TouchGrass: [BackgroundTick] Reminder operations failed', reminderError);
        throw reminderError; // Re-throw to be caught by the isolated try/catch in orchestrator
      }
    } else {
      await insertBackgroundLogAsync(
        'reminder',
        'Reminders disabled — skipping background tick work'
      );
    }
  }

  /**
   * Register the unified background task with WorkManager / BGTaskScheduler.
   */
  public async registerUnifiedBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(UNIFIED_BACKGROUND_TASK);
      if (!isRegistered) {
        await BackgroundTask.registerTaskAsync(UNIFIED_BACKGROUND_TASK, {
          minimumInterval: 15,
        });
        console.log('TouchGrass: [UnifiedTask] Registered');
      }
    } catch (error) {
      console.error('TouchGrass: [UnifiedTask] Failed to register', error);
    }
  }

  /**
   * Unregister the unified background task.
   */
  public async unregisterUnifiedBackgroundTask(): Promise<void> {
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
}

export const BackgroundService = new BackgroundServiceImpl();

/**
 * Define the unified background task.
 * Must be called at module scope for registration before JS bundle fully loads.
 */
TaskManager.defineTask(UNIFIED_BACKGROUND_TASK, async () => {
  try {
    console.log('TouchGrass: [UnifiedTask] Tick (WorkManager fallback)');

    await BackgroundService.performBackgroundTick();

    // Re-arm the Pulsar chain in case it was interrupted.
    await BackgroundService.scheduleNextAlarmPulse().catch((e: Error) =>
      console.warn('TouchGrass: [UnifiedTask] Failed to re-arm alarm chain', e)
    );

    console.log('TouchGrass: [UnifiedTask] Tick done');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('TouchGrass: [UnifiedTask] Fatal error', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
