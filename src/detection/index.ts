import * as Location from 'expo-location';
import {
  syncHealthConnect,
  requestHealthPermissions,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
} from './healthConnect';
import { verifyHealthConnectPermissions } from './healthConnectIntent';
import { startLocationTracking, stopLocationTracking } from './gpsDetection';
import { getKnownLocationsAsync, getSettingAsync, setSettingAsync } from '../storage';
import { PermissionService } from './PermissionService';
import {
  computeMinActiveRadius,
  clampRadiusMeters,
  computeDwellClusters,
  autoDetectLocations,
} from './GeofenceManager';

// Setting keys for the user's explicit intent (independent of OS permission state)
const HC_USER_KEY = 'healthconnect_enabled';
const GPS_USER_KEY = 'gps_enabled';

/**
 * Initial detection setup.
 */
export async function initDetection(): Promise<DetectionStatus> {
  const status = await getDetectionStatus();

  // Auto-disable if the user intended to use HC but permissions were revoked/missing.
  // This ensures the UI reflects the actual functional state.
  if (status.healthConnect && !status.healthConnectPermission) {
    await setSettingAsync(HC_USER_KEY, '0');
    status.healthConnect = false;
  }

  if (status.healthConnect && status.healthConnectPermission) {
    syncHealthConnect().catch((err) => console.error('Health Connect init sync failed:', err));
  }
  return status;
}

/**
 * Check whether foreground location permission is granted for weather.
 */
export async function checkWeatherLocationPermissions(): Promise<boolean> {
  return PermissionService.checkWeatherLocationPermissions();
}

/**
 * Request foreground location permission for weather-aware reminders.
 */
export async function requestWeatherLocationPermissions(): Promise<boolean> {
  return PermissionService.requestWeatherLocationPermissions();
}

/**
 * Check whether GPS OS permissions (foreground + background) are granted.
 */
export async function checkGPSPermissions(): Promise<boolean> {
  try {
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    return fg === 'granted' && bg === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request GPS OS permissions.
 */
export async function requestGPSPermissions(): Promise<boolean> {
  return PermissionService.requestLocationPermissions();
}

/**
 * Re-evaluate and reconcile detection states.
 * Should be called when the app foregrounds or settings change.
 */
export async function refreshDetectionSync(): Promise<void> {
  const gpsUserEnabled = (await getSettingAsync(GPS_USER_KEY, '0')) === '1';
  const hcUserEnabled = (await getSettingAsync(HC_USER_KEY, '0')) === '1';

  if (gpsUserEnabled) {
    const perm = await checkGPSPermissions();
    if (perm) {
      const locations = await getKnownLocationsAsync();
      const minRadius = computeMinActiveRadius(locations);
      await startLocationTracking('low', minRadius);
    } else {
      await stopLocationTracking();
    }
  } else {
    await stopLocationTracking();
  }

  if (hcUserEnabled) {
    const available = await isHealthConnectAvailable();
    if (available) {
      await syncHealthConnect();
    }
  }
}

/**
 * Get a high-level summary of the current detection state.
 */
export async function getDetectionStatus(): Promise<DetectionStatus> {
  const [gpsUser, hcUser, gpsPerm, hcPerm, hcAvailable] = await Promise.all([
    getSettingAsync(GPS_USER_KEY, '0'),
    getSettingAsync(HC_USER_KEY, '0'),
    checkGPSPermissions(),
    verifyHealthConnectPermissions(),
    isHealthConnectAvailable(),
  ]);

  return {
    gps: gpsUser === '1',
    healthConnect: hcUser === '1',
    healthConnectAvailable: hcAvailable,
    healthConnectPermission: hcPerm,
    gpsPermission: gpsPerm,
  };
}

export interface DetectionStatus {
  gps: boolean;
  healthConnect: boolean;
  healthConnectAvailable: boolean;
  healthConnectPermission: boolean;
  gpsPermission: boolean;
}

/**
 * Toggle GPS detection and ensure the OS task state matches.
 */
export async function toggleGPS(enabled: boolean): Promise<{ needsPermissions: boolean }> {
  await setSettingAsync(GPS_USER_KEY, enabled ? '1' : '0');
  if (enabled) {
    const hasPerm = await checkGPSPermissions();
    if (hasPerm) {
      const locations = await getKnownLocationsAsync();
      const minRadius = computeMinActiveRadius(locations);
      await startLocationTracking('low', minRadius);
      return { needsPermissions: false };
    }
    return { needsPermissions: true };
  } else {
    await stopLocationTracking();
    return { needsPermissions: false };
  }
}

/**
 * Toggle Health Connect detection and run an immediate sync if enabled.
 */
export async function toggleHealthConnect(
  enabled: boolean
): Promise<{ needsPermissions: boolean }> {
  await setSettingAsync(HC_USER_KEY, enabled ? '1' : '0');
  if (enabled) {
    const hasPerm = await verifyHealthConnectPermissions();
    if (hasPerm) {
      await syncHealthConnect();
      return { needsPermissions: false };
    }
    return { needsPermissions: true };
  }
  return { needsPermissions: false };
}

/**
 * Perform a full catch-up on all enabled detection modules.
 * Called when the app is opened (foreground sync).
 */
export async function runCatchUpDetectionAsync(): Promise<void> {
  const status = await getDetectionStatus();
  if (status.healthConnect && status.healthConnectPermission) {
    await syncHealthConnect();
  }
}

export {
  syncHealthConnect,
  requestHealthPermissions,
  requestHealthPermissions as requestHealthConnect,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
  startLocationTracking,
  stopLocationTracking,
  clampRadiusMeters,
  computeDwellClusters,
  autoDetectLocations,
};

/** @deprecated Use verifyHealthConnectPermissions */
export const recheckHealthConnect = verifyHealthConnectPermissions;
