import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncHealthConnect, requestHealthPermissions, isHealthConnectAvailable } from './healthConnect';
import { startLocationTracking, autoDetectLocations } from './gpsDetection';
import { getSetting, setSetting } from '../storage/database';
import { scheduleNextReminder } from '../notifications/notificationManager';

const BACKGROUND_TASK_NAME = 'TOUCHGRASS_BACKGROUND_TASK';

/**
 * Register the background task.
 * This runs periodically when the app is in the background.
 */
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    await syncHealthConnect();
    await autoDetectLocations();
    await scheduleNextReminder();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('Background task error:', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Initialize all detection sources.
 * Call this once on app startup.
 */
export async function initDetection(): Promise<DetectionStatus> {
  const status: DetectionStatus = {
    healthConnect: false,
    gps: false,
  };

  // Health Connect
  const hcAvailable = await isHealthConnectAvailable();
  if (hcAvailable) {
    const hcGranted = await requestHealthPermissions();
    if (hcGranted) {
      status.healthConnect = true;
      setSetting('healthconnect_enabled', '1');
    }
  }

  // GPS
  try {
    await startLocationTracking();
    status.gps = true;
    setSetting('gps_enabled', '1');
  } catch (e) {
    console.warn('GPS init error:', e);
  }

  // Background task
  await registerBackgroundTask();

  return status;
}

/**
 * Register background task for periodic sync and reminders.
 */
async function registerBackgroundTask(): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes
    });
  } catch (e) {
    console.warn('Background task registration error:', e);
  }
}

/**
 * Get current detection status from settings.
 */
export function getDetectionStatus(): DetectionStatus {
  return {
    healthConnect: getSetting('healthconnect_enabled', '0') === '1',
    gps: getSetting('gps_enabled', '0') === '1',
  };
}

export interface DetectionStatus {
  healthConnect: boolean;
  gps: boolean;
}
