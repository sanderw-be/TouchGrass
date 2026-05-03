import * as Location from 'expo-location';
import {
  syncHealthConnect,
  requestHealthPermissions,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
} from './healthConnect';
import { verifyHealthConnectPermissions } from './healthConnectIntent';
import { startGeofenceTracking, stopGeofenceTracking } from './gpsDetection';
import { getSettingAsync, setSettingAsync } from '../storage';
import { PermissionService } from './PermissionService';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import { clampRadiusMeters, computeDwellClusters, autoDetectLocations } from './GeofenceManager';

// Setting keys for the user's explicit intent (independent of OS permission state)
const HC_USER_KEY = 'healthconnect_enabled';
const GPS_USER_KEY = 'gps_enabled';
const AR_USER_KEY = 'ar_enabled';

/**
 * Initial detection setup.
 * Reconciles user intent with actual OS permissions and starts/stops
 * background services accordingly.
 */
export async function initDetection(): Promise<DetectionStatus> {
  const status = await getDetectionStatus();

  // Reconcile background tasks with current settings and permissions
  await refreshDetectionSync();

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
      try {
        await startGeofenceTracking();
      } catch (e) {
        console.error('Failed to start Geofencing during sync:', e);
      }
    } else {
      try {
        await stopGeofenceTracking();
      } catch (e) {
        console.error('Failed to stop Geofencing during sync:', e);
      }
    }
  } else {
    try {
      await stopGeofenceTracking();
    } catch (e) {
      console.error('Failed to stop Geofencing during sync:', e);
    }
  }

  if (hcUserEnabled) {
    const available = await isHealthConnectAvailable();
    if (available) {
      const perm = await verifyHealthConnectPermissions();
      if (perm) {
        // Kick off sync in background to avoid blocking app init
        syncHealthConnect();
      }
    }
  }

  const arUserEnabled = (await getSettingAsync(AR_USER_KEY, '0')) === '1';
  if (arUserEnabled) {
    const perm = await PermissionService.checkActivityRecognitionPermissions();
    if (perm) {
      try {
        await ActivityTransitionModule.startTracking();
      } catch (e) {
        console.error('Failed to start AR tracking during sync:', e);
      }
    } else {
      try {
        await ActivityTransitionModule.stopTracking();
      } catch (e) {
        console.error('Failed to stop AR tracking during sync:', e);
      }
    }
  } else {
    try {
      await ActivityTransitionModule.stopTracking();
    } catch (e) {
      console.error('Failed to stop AR tracking during sync:', e);
    }
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
      try {
        await startGeofenceTracking();
        return { needsPermissions: false };
      } catch (e: unknown) {
        console.error('Failed to start Geofencing in toggleGPS:', e);
        return { needsPermissions: false };
      }
    }
    return { needsPermissions: true };
  } else {
    try {
      await stopGeofenceTracking();
    } catch (e) {
      console.error('Failed to stop Geofencing in toggleGPS:', e);
    }
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
      try {
        await syncHealthConnect();
        return { needsPermissions: false };
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          (e.message.includes('SecurityException') || e.message.includes('permission'))
        ) {
          console.warn('Health Connect sync failed due to permission issue:', e.message);
        } else {
          console.error('Failed to sync Health Connect in toggleHealthConnect:', e);
        }
        return { needsPermissions: false };
      }
    }
    return { needsPermissions: true };
  }
  return { needsPermissions: false };
}

export async function toggleAR(enabled: boolean): Promise<{ needsPermissions: boolean }> {
  await setSettingAsync(AR_USER_KEY, enabled ? '1' : '0');

  if (enabled) {
    const hasPerm = await PermissionService.checkActivityRecognitionPermissions();
    if (hasPerm) {
      try {
        await ActivityTransitionModule.startTracking();
        return { needsPermissions: false };
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          (e.message.includes('SecurityException') || e.message.includes('permission'))
        ) {
          console.warn('AR tracking start failed due to permission issue:', e.message);
        } else {
          console.error('Failed to start AR tracking in toggleAR:', e);
        }
        return { needsPermissions: false }; // Still return false as intent was recorded
      }
    }
    return { needsPermissions: true };
  } else {
    try {
      await ActivityTransitionModule.stopTracking();
    } catch (e) {
      console.error('Failed to stop AR tracking in toggleAR:', e);
    }
    return { needsPermissions: false };
  }
}
export {
  syncHealthConnect,
  requestHealthPermissions,
  verifyHealthConnectPermissions,
  isHealthConnectAvailable,
  openHealthConnectForManagement,
  startGeofenceTracking,
  stopGeofenceTracking,
  clampRadiusMeters,
  computeDwellClusters,
  autoDetectLocations,
  PermissionService,
};
