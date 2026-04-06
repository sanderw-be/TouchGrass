import * as Location from 'expo-location';
import {
  syncHealthConnect,
  requestHealthPermissions,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
} from './healthConnect';
import { verifyHealthConnectPermissions } from './healthConnectIntent';
import {
  startLocationTracking,
  stopLocationTracking,
  computeMinActiveRadius,
} from './gpsDetection';
import { getKnownLocationsAsync, getSettingAsync, setSettingAsync } from '../storage/database';

// Setting keys for the user's explicit intent (independent of OS permission state)
const HC_USER_KEY = 'healthconnect_user_enabled';
const GPS_USER_KEY = 'gps_user_enabled';
// Sentinel used to detect whether the one-time settings migration has run.
const UNSET_MARKER = '__unset__';

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
  if ((await getSettingAsync(HC_USER_KEY, UNSET_MARKER)) === UNSET_MARKER) {
    await setSettingAsync(HC_USER_KEY, await getSettingAsync('healthconnect_enabled', '0'));
  }
  if ((await getSettingAsync(GPS_USER_KEY, UNSET_MARKER)) === UNSET_MARKER) {
    await setSettingAsync(GPS_USER_KEY, await getSettingAsync('gps_enabled', '0'));
  }

  const status: DetectionStatus = {
    healthConnect: (await getSettingAsync(HC_USER_KEY, '0')) === '1',
    healthConnectPermission: false,
    gps: (await getSettingAsync(GPS_USER_KEY, '0')) === '1',
    gpsPermission: false,
  };

  // Health Connect — only run if the user has explicitly enabled it.
  const hcAvailable = await isHealthConnectAvailable();
  if (hcAvailable && status.healthConnect) {
    // Fast permission check — does not read health data.
    const hasPermissions = await verifyHealthConnectPermissions();
    status.healthConnectPermission = hasPermissions;
    await setSettingAsync('healthconnect_enabled', hasPermissions ? '1' : '0');

    // Kick off a sync in the background so app startup is not blocked.
    if (hasPermissions) {
      syncHealthConnect().catch((e) => console.warn('HC background sync error:', e));
    }
  }

  // GPS — only run if the user has explicitly enabled it.
  if (status.gps) {
    try {
      await startLocationTracking('low', computeMinActiveRadius(await getKnownLocationsAsync()));
      status.gpsPermission = true;
      await setSettingAsync('gps_enabled', '1');
    } catch (e) {
      console.warn('GPS init error:', e);
      await setSettingAsync('gps_enabled', '0');
    }
  }

  return status;
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
      await setSettingAsync(HC_USER_KEY, '1');
      await setSettingAsync('healthconnect_enabled', '1');
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
    if ((await getSettingAsync(HC_USER_KEY, '0')) !== '1') {
      return false;
    }

    const available = await isHealthConnectAvailable();
    if (!available) return false;

    // Fast permission check — does not read health data.
    const hasPermissions = await verifyHealthConnectPermissions();
    // Update permission status but leave the user-toggle unchanged.
    await setSettingAsync('healthconnect_enabled', hasPermissions ? '1' : '0');

    // Kick off a sync in the background; do not block the foreground resume.
    if (hasPermissions) {
      syncHealthConnect().catch((e) => console.warn('HC background sync error:', e));
    }

    return hasPermissions;
  } catch {
    await setSettingAsync('healthconnect_enabled', '0');
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

export async function getDetectionStatus(): Promise<DetectionStatus> {
  return {
    healthConnect: (await getSettingAsync(HC_USER_KEY, '0')) === '1',
    healthConnectPermission: (await getSettingAsync('healthconnect_enabled', '0')) === '1',
    gps: (await getSettingAsync(GPS_USER_KEY, '0')) === '1',
    gpsPermission: (await getSettingAsync('gps_enabled', '0')) === '1',
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
    await setSettingAsync('gps_enabled', granted ? '1' : '0');

    return granted;
  } catch (e) {
    console.warn('GPS permission check error:', e);
    await setSettingAsync('gps_enabled', '0');
    return false;
  }
}

/**
 * Request GPS permissions and start tracking if granted.
 */
export async function requestGPSPermissions(): Promise<boolean> {
  try {
    // Request foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      await setSettingAsync('gps_enabled', '0');
      // If user explicitly denied, return false immediately
      return false;
    }

    // Request background permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    const granted = bgStatus === 'granted';

    if (granted) {
      await startLocationTracking('low', computeMinActiveRadius(await getKnownLocationsAsync()));
      await setSettingAsync('gps_enabled', '1');
    } else {
      // Background permission denied or not determined
      // Update setting to reflect this
      await setSettingAsync('gps_enabled', '0');
    }

    return granted;
  } catch (e) {
    console.warn('GPS permission request error:', e);
    await setSettingAsync('gps_enabled', '0');
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
export async function toggleHealthConnect(
  enabled: boolean
): Promise<{ needsPermissions: boolean }> {
  if (!enabled) {
    await setSettingAsync(HC_USER_KEY, '0');
    await setSettingAsync('healthconnect_enabled', '0');
    return { needsPermissions: false };
  }

  // Record the user's intent immediately so background rechecks can run.
  await setSettingAsync(HC_USER_KEY, '1');

  try {
    const available = await isHealthConnectAvailable();
    if (!available) {
      // HC not installed on this device — flag stays on so the user can see
      // the error state, but there is nothing to open.
      await setSettingAsync('healthconnect_enabled', '0');
      return { needsPermissions: false };
    }

    const hasPermissions = await verifyHealthConnectPermissions();
    await setSettingAsync('healthconnect_enabled', hasPermissions ? '1' : '0');

    // Kick off a sync in the background; do not block the toggle response.
    if (hasPermissions) {
      syncHealthConnect().catch((e) => console.warn('HC background sync error:', e));
    }

    return { needsPermissions: !hasPermissions };
  } catch (e) {
    console.warn('Health Connect toggle error:', e);
    await setSettingAsync('healthconnect_enabled', '0');
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
    await setSettingAsync(GPS_USER_KEY, '0');
    await setSettingAsync('gps_enabled', '0');
    await stopLocationTracking();
    return { needsPermissions: false };
  }

  // Record the user's intent immediately.
  await setSettingAsync(GPS_USER_KEY, '1');

  try {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    const granted = fgStatus === 'granted' && bgStatus === 'granted';

    await setSettingAsync('gps_enabled', granted ? '1' : '0');

    if (granted) {
      await startLocationTracking('low', computeMinActiveRadius(await getKnownLocationsAsync()));
    }

    return { needsPermissions: !granted };
  } catch (e) {
    console.warn('GPS toggle error:', e);
    await setSettingAsync('gps_enabled', '0');
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

/**
 * Check whether foreground location permission is granted for weather.
 * Weather only requires "While using the app" (foreground) location access.
 * In the background task, location falls back to the SQLite-cached coordinates
 * from the last foreground fetch if foreground-only permission is in effect.
 */
export async function checkWeatherLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Weather location permission check error:', e);
    return false;
  }
}

/**
 * Request foreground location permission for weather-aware reminders.
 * Weather only needs "While using the app" — it does NOT request background
 * ("Allow all the time") access.  Background weather fetches gracefully degrade
 * to cached coordinates when background permission is not available.
 * Returns true if foreground permission is granted.
 */
export async function requestWeatherLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Weather location permission request error:', e);
    return false;
  }
}
