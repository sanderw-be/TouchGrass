import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import { syncHealthConnect, requestHealthPermissions, isHealthConnectAvailable, openHealthConnectForManagement } from './healthConnect';
import { verifyHealthConnectPermissions } from './healthConnectIntent';
import { startLocationTracking, autoDetectLocations } from './gpsDetection';
import { getSetting, setSetting } from '../storage/database';
import { scheduleNextReminder, scheduleDayReminders, maybeScheduleCatchUpReminder } from '../notifications/notificationManager';
import { fetchWeatherForecast } from '../weather/weatherService';

// Setting keys for the user's explicit intent (independent of OS permission state)
const HC_USER_KEY = 'healthconnect_user_enabled';
const GPS_USER_KEY = 'gps_user_enabled';
// Sentinel used to detect whether the one-time settings migration has run.
const UNSET_MARKER = '__unset__';

const BACKGROUND_TASK_NAME = 'TOUCHGRASS_BACKGROUND_TASK';

/**
 * Register the background task.
 * This runs periodically when the app is in the background.
 */
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    // Check calendar permission from within the background task context and log it.
    // On Android the foreground app and background task share the same process/UID so
    // permissions granted in the foreground should be visible here too — but this log
    // makes that assumption observable in logcat so we can confirm it.
    try {
      const calPerm = await Calendar.getCalendarPermissionsAsync();
      console.warn('TouchGrass: Background task calendar permission', {
        status: calPerm.status,
        granted: calPerm.granted,
        canAskAgain: calPerm.canAskAgain,
      });
    } catch (calPermError) {
      console.warn('TouchGrass: Failed to check calendar permission in background task', calPermError);
    }

    await syncHealthConnect();
    await autoDetectLocations();
    
    // Fetch weather data for smart reminders (graceful fallback if it fails)
    try {
      const weatherEnabled = getSetting('weather_enabled', '1') === '1';
      if (weatherEnabled) {
        await fetchWeatherForecast({ allowPermissionPrompt: false });
      }
    } catch (weatherError) {
      console.warn('Weather fetch failed in background task:', weatherError);
      // Continue with reminder scheduling even if weather fails
    }
    
    // Plan the day's reminders once per new day (at/after midnight).
    // This must run before scheduleNextReminder() so that the planned
    // notifications are not cancelled by the fallback path.
    await scheduleDayReminders();

    // Attempt to fire an immediate reminder.  Returns early if the day's
    // reminders have already been planned by scheduleDayReminders().
    await scheduleNextReminder();

    // Check if a catch-up reminder is needed (user behind on daily goal)
    await maybeScheduleCatchUpReminder();

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('Background task error:', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Initialize all detection sources.
 * Call this once on app startup.
 *
 * Migrates existing users: if the explicit user-toggle settings are not yet
 * stored we infer the user's intent from the legacy enabled flags so that
 * users who already set up HC / GPS keep their experience unchanged.
 */
export async function initDetection(): Promise<DetectionStatus> {
  // One-time migration: copy old enabled flags to the new user-toggle keys.
  if (getSetting(HC_USER_KEY, UNSET_MARKER) === UNSET_MARKER) {
    setSetting(HC_USER_KEY, getSetting('healthconnect_enabled', '0'));
  }
  if (getSetting(GPS_USER_KEY, UNSET_MARKER) === UNSET_MARKER) {
    setSetting(GPS_USER_KEY, getSetting('gps_enabled', '0'));
  }

  const status: DetectionStatus = {
    healthConnect: getSetting(HC_USER_KEY, '0') === '1',
    healthConnectPermission: false,
    gps: getSetting(GPS_USER_KEY, '0') === '1',
    gpsPermission: false,
  };

  // Health Connect — only run if the user has explicitly enabled it.
  const hcAvailable = await isHealthConnectAvailable();
  if (hcAvailable && status.healthConnect) {
    const ok = await syncHealthConnect();
    status.healthConnectPermission = ok;
    // Only mark permission as granted when sync explicitly succeeds.
    // A transient failure must not permanently turn off the integration.
    if (ok) {
      setSetting('healthconnect_enabled', '1');
    }
  }

  // GPS — only run if the user has explicitly enabled it.
  if (status.gps) {
    try {
      await startLocationTracking();
      status.gpsPermission = true;
      setSetting('gps_enabled', '1');
    } catch (e) {
      console.warn('GPS init error:', e);
      setSetting('gps_enabled', '0');
    }
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
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: 15, // minutes
      });
      console.log('TouchGrass: background task registered with minimumInterval 15 min');
    }
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
      setSetting(HC_USER_KEY, '1');
      setSetting('healthconnect_enabled', '1');
    }
    return granted;
  } catch (e) {
    console.warn('Health Connect request error:', e);
    return false;
  }
}

/**
 * Re-check Health Connect permission status without requesting permissions.
 * Only runs if the user has explicitly enabled the HC toggle.
 * Call this when the app comes back to foreground.
 * Updates the permission status setting but never touches the user-toggle.
 */
export async function recheckHealthConnect(): Promise<boolean> {
  try {
    // Skip the check entirely when the user has not enabled the toggle.
    if (getSetting(HC_USER_KEY, '0') !== '1') {
      return false;
    }

    const available = await isHealthConnectAvailable();
    if (!available) return false;
    
    // Verify permissions by attempting to read data
    const hasPermissions = await verifyHealthConnectPermissions();
    // Update permission status but leave the user-toggle unchanged.
    setSetting('healthconnect_enabled', hasPermissions ? '1' : '0');
    
    // If permissions are granted, try to sync data
    if (hasPermissions) {
      await syncHealthConnect();
    }
    
    return hasPermissions;
  } catch {
    setSetting('healthconnect_enabled', '0');
    return false;
  }
}

/**
 * Open Health Connect settings for managing existing permissions.
 * Call this from the Settings screen "Manage permissions" button.
 * Always tries to open settings, even if permissions are already granted.
 */
export async function openHealthConnectSettings(): Promise<boolean> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) {
      console.warn('Health Connect not available on this device');
      return false;
    }
    return await openHealthConnectForManagement();
  } catch (e) {
    console.warn('Health Connect settings open error:', e);
    return false;
  }
}


export function getDetectionStatus(): DetectionStatus {
  return {
    healthConnect: getSetting(HC_USER_KEY, '0') === '1',
    healthConnectPermission: getSetting('healthconnect_enabled', '0') === '1',
    gps: getSetting(GPS_USER_KEY, '0') === '1',
    gpsPermission: getSetting('gps_enabled', '0') === '1',
  };
}

/**
 * Check GPS permission status (foreground + background).
 * Updates the permission-status setting but never touches the user-toggle.
 * Returns true if both permissions are granted.
 */
export async function checkGPSPermissions(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    const granted = fgStatus === 'granted' && bgStatus === 'granted';
    
    // Update the permission status but leave the user-toggle unchanged.
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

/**
 * Explicitly enable the Health Connect toggle.
 * Sets the user-intent flag, then checks whether OS permissions are already
 * granted.  Returns whether HC is now fully operational and whether the caller
 * still needs to open the permissions page.
 *
 * Call this when the user flips the HC switch ON (Settings or Intro).
 */
export async function toggleHealthConnect(enabled: boolean): Promise<{ needsPermissions: boolean }> {
  if (!enabled) {
    setSetting(HC_USER_KEY, '0');
    setSetting('healthconnect_enabled', '0');
    return { needsPermissions: false };
  }

  // Record the user's intent immediately so background rechecks can run.
  setSetting(HC_USER_KEY, '1');

  try {
    const available = await isHealthConnectAvailable();
    if (!available) {
      // HC not installed on this device — flag stays on so the user can see
      // the error state, but there is nothing to open.
      setSetting('healthconnect_enabled', '0');
      return { needsPermissions: false };
    }

    const hasPermissions = await verifyHealthConnectPermissions();
    setSetting('healthconnect_enabled', hasPermissions ? '1' : '0');

    if (hasPermissions) {
      await syncHealthConnect();
    }

    return { needsPermissions: !hasPermissions };
  } catch (e) {
    console.warn('Health Connect toggle error:', e);
    setSetting('healthconnect_enabled', '0');
    return { needsPermissions: true };
  }
}

/**
 * Explicitly enable or disable the GPS toggle.
 * Sets the user-intent flag, then checks current OS permissions.
 * Returns whether the caller still needs to request permissions from the OS.
 *
 * Call this when the user flips the GPS switch ON/OFF (Settings or Intro).
 */
export async function toggleGPS(enabled: boolean): Promise<{ needsPermissions: boolean }> {
  if (!enabled) {
    setSetting(GPS_USER_KEY, '0');
    setSetting('gps_enabled', '0');
    return { needsPermissions: false };
  }

  // Record the user's intent immediately.
  setSetting(GPS_USER_KEY, '1');

  try {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    const granted = fgStatus === 'granted' && bgStatus === 'granted';

    setSetting('gps_enabled', granted ? '1' : '0');

    if (granted) {
      await startLocationTracking();
    }

    return { needsPermissions: !granted };
  } catch (e) {
    console.warn('GPS toggle error:', e);
    setSetting('gps_enabled', '0');
    return { needsPermissions: true };
  }
}

export interface DetectionStatus {
  /** Whether the user has explicitly enabled the Health Connect toggle. */
  healthConnect: boolean;
  /** Whether Health Connect OS permissions are actually granted (meaningful when healthConnect=true). */
  healthConnectPermission: boolean;
  /** Whether the user has explicitly enabled the GPS toggle. */
  gps: boolean;
  /** Whether GPS OS permissions are actually granted (meaningful when gps=true). */
  gpsPermission: boolean;
}
