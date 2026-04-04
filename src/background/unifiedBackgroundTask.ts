/**
 * Unified background task — WorkManager fallback.
 *
 * The primary background execution path is the Pulsar chained-alarm:
 *   AlarmBridge.scheduleNextPulse → PulseAlarmReceiver → AlarmPulseService →
 *   TOUCHGRASS_PULSE_TASK (registered in index.ts) → performBackgroundTick
 *
 * This WorkManager task remains registered as a best-effort fallback in case
 * the alarm chain is interrupted (e.g. after an OTA update or first launch).
 * It also re-arms the Pulsar chain on each WorkManager wake so the alarm
 * self-heals even if it was lost.
 *
 * Root cause of the staleness bug: WorkManager cancels periodic tasks after
 * ~12 h of no user interaction (CancellationException in WorkerWrapper), so
 * the task fires but the JS body never executes. The Pulsar alarm bypasses
 * WorkManager's quota entirely.
 */

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { performBackgroundTick } from './backgroundTick';
import { scheduleNextAlarmPulse } from './alarmTiming';

export const UNIFIED_BACKGROUND_TASK = 'TOUCHGRASS_UNIFIED_TASK';

/**
 * Define the unified background task.
 * Must be called at module scope so TaskManager can register it before the
 * app JS bundle fully loads (required for background wake-ups).
 */
TaskManager.defineTask(UNIFIED_BACKGROUND_TASK, async () => {
  try {
    console.log('TouchGrass: [UnifiedTask] Tick (WorkManager fallback)');

    await performBackgroundTick();

    // Re-arm the Pulsar chain in case it was interrupted.
    await scheduleNextAlarmPulse().catch((e) =>
      console.warn('TouchGrass: [UnifiedTask] Failed to re-arm alarm chain', e)
    );

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
