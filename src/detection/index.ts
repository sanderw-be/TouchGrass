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
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import {
  computeMinActiveRadius,
  clampRadiusMeters,
  computeDwellClusters,
  autoDetectLocations,
} from './GeofenceManager';

// Setting keys for the user's explicit intent (independent of OS permission state)
const HC_USER_KEY = 'healthconnect_enabled';
const GPS_USER_KEY = 'gps_enabled';
const AR_USER_KEY = 'ar_enabled';

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

  if (status.activityRecognition && !status.activityRecognitionPermission) {
    await setSettingAsync(AR_USER_KEY, '0');
    status.activityRecognition = false;
  }

  if (status.healthConnect && status.healthConnectPermission) {
    syncHealthConnect().catch((err) => console.error('Health Connect init sync failed:', err));
  }

  if (status.activityRecognition && status.activityRecognitionPermission) {
    ActivityTransitionModule.startTracking().catch((err) =>
      console.error('AR init tracking failed:', err)
    );
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
export async function requestGPSPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { granted: false, canAskAgain };
  }
  const { status: bgStatus, canAskAgain: bgCanAskAgain } =
    await Location.requestBackgroundPermissionsAsync();
  return { granted: bgStatus === 'granted', canAskAgain: bgCanAskAgain };
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

  const arUserEnabled = (await getSettingAsync(AR_USER_KEY, '0')) === '1';
  if (arUserEnabled) {
    const perm = await PermissionService.checkActivityRecognitionPermissions();
    if (perm) {
      await ActivityTransitionModule.startTracking();
    } else {
      await ActivityTransitionModule.stopTracking();
    }
  } else {
    await ActivityTransitionModule.stopTracking();
  }
}

/**
 * Get a high-level summary of the current detection state.
 */
export async function getDetectionStatus(): Promise<DetectionStatus> {
  const [gpsUser, hcUser, arUser, gpsPerm, hcPerm, hcAvailable, arPerm] = await Promise.all([
    getSettingAsync(GPS_USER_KEY, '0'),
    getSettingAsync(HC_USER_KEY, '0'),
    getSettingAsync(AR_USER_KEY, '0'),
    checkGPSPermissions(),
    verifyHealthConnectPermissions(),
    isHealthConnectAvailable(),
    PermissionService.checkActivityRecognitionPermissions(),
  ]);

  return {
    gps: gpsUser === '1',
    healthConnect: hcUser === '1',
    activityRecognition: arUser === '1',
    healthConnectAvailable: hcAvailable,
    healthConnectPermission: hcPerm,
    gpsPermission: gpsPerm,
    activityRecognitionPermission: arPerm,
  };
}

export interface DetectionStatus {
  gps: boolean;
  healthConnect: boolean;
  activityRecognition: boolean;
  healthConnectAvailable: boolean;
  healthConnectPermission: boolean;
  gpsPermission: boolean;
  activityRecognitionPermission: boolean;
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
 * Toggle Activity Recognition detection and start/stop the Native Module.
 */
export async function toggleAR(enabled: boolean): Promise<{ needsPermissions: boolean }> {
  await setSettingAsync(AR_USER_KEY, enabled ? '1' : '0');

  if (enabled) {
    const hasPerm = await PermissionService.checkActivityRecognitionPermissions();
    if (hasPerm) {
      await ActivityTransitionModule.startTracking();
      return { needsPermissions: false };
    }
    return { needsPermissions: true };
  } else {
    await ActivityTransitionModule.stopTracking();
    return { needsPermissions: false };
  }
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
  if (status.activityRecognition && status.activityRecognitionPermission) {
    await ActivityTransitionModule.startTracking();
  }
}

export {
  syncHealthConnect,
  requestHealthPermissions,
  verifyHealthConnectPermissions,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
  startLocationTracking,
  stopLocationTracking,
  clampRadiusMeters,
  computeDwellClusters,
  autoDetectLocations,
};
