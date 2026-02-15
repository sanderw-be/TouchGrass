import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { syncHealthConnect, requestHealthPermissions, isHealthConnectAvailable } from './healthConnect';
import { startLocationTracking, autoDetectLocations } from './gpsDetection';
import { getSetting, setSetting } from '../storage/database';
import { scheduleNextReminder } from '../notifications/notificationManager';
import { fetchWeatherForecast } from '../weather/weatherService';

const BACKGROUND_TASK_NAME = 'TOUCHGRASS_BACKGROUND_TASK';

/**
 * Register the background task.
 * This runs periodically when the app is in the background.
 */
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    await syncHealthConnect();
    await autoDetectLocations();
    
    // Fetch weather data for smart reminders (graceful fallback if it fails)
    try {
      const weatherEnabled = getSetting('weather_enabled', '1') === '1';
      if (weatherEnabled) {
        await fetchWeatherForecast();
      }
    } catch (weatherError) {
      console.warn('Weather fetch failed in background task:', weatherError);
      // Continue with reminder scheduling even if weather fails
    }
    
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
 * Manually request Health Connect permissions.
 * Call this from the Settings screen connect button.
 * Returns the updated status.
 */
export async function requestHealthConnect(): Promise<boolean> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) {
      console.warn('Health Connect not available on this device');
      return false;
    }
    const granted = await requestHealthPermissions();
    if (granted) {
      setSetting('healthconnect_enabled', '1');
    }
    return granted;
  } catch (e) {
    console.warn('Health Connect request error:', e);
    return false;
  }
}

/**
 * Re-check Health Connect status without requesting permissions.
 * Call this when the app comes back to foreground.
 */
export async function recheckHealthConnect(): Promise<boolean> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return false;
    // Try to sync — if permissions were granted it will succeed
    await syncHealthConnect();
    setSetting('healthconnect_enabled', '1');
    return true;
  } catch {
    setSetting('healthconnect_enabled', '0');
    return false;
  }
}


export function getDetectionStatus(): DetectionStatus {
  return {
    healthConnect: getSetting('healthconnect_enabled', '0') === '1',
    gps: getSetting('gps_enabled', '0') === '1',
  };
}

/**
 * Check GPS permission status (foreground + background).
 * Returns true if both permissions are granted.
 */
export async function checkGPSPermissions(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    const granted = fgStatus === 'granted' && bgStatus === 'granted';
    
    // Update the setting to reflect actual permission status
    setSetting('gps_enabled', granted ? '1' : '0');
    
    return granted;
  } catch (e) {
    console.warn('GPS permission check error:', e);
    setSetting('gps_enabled', '0');
    return false;
  }
}

/**
 * Request GPS permissions and start tracking if granted.
 */
export async function requestGPSPermissions(): Promise<boolean> {
  try {
    // Check current foreground permission status
    const { status: currentFgStatus } = await Location.getForegroundPermissionsAsync();
    
    // Request foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setSetting('gps_enabled', '0');
      // If user explicitly denied, return false immediately
      return false;
    }
    
    // Check current background permission status
    const { status: currentBgStatus } = await Location.getBackgroundPermissionsAsync();
    
    // Request background permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    const granted = bgStatus === 'granted';
    
    if (granted) {
      await startLocationTracking();
      setSetting('gps_enabled', '1');
    } else {
      // Background permission denied or not determined
      // Update setting to reflect this
      setSetting('gps_enabled', '0');
    }
    
    return granted;
  } catch (e) {
    console.warn('GPS permission request error:', e);
    setSetting('gps_enabled', '0');
    return false;
  }
}

export interface DetectionStatus {
  healthConnect: boolean;
  gps: boolean;
}
