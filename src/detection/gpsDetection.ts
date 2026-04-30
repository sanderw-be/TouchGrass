import { LocationTracker } from './LocationTracker';
import { PermissionService } from './PermissionService';
import {
  computeMinActiveRadius as _computeMinActiveRadius,
  autoDetectLocations as _autoDetectLocations,
} from './GeofenceManager';
import { MAX_RADIUS_METERS } from './constants';
import { KnownLocation } from '../storage';

export { MAX_RADIUS_METERS, MIN_OUTSIDE_DURATION_MS } from './constants';

export async function loadGPSState(): Promise<void> {
  await LocationTracker.getInstance().loadState();
}

export async function requestLocationPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  return PermissionService.requestLocationPermissions();
}

export function computeMinActiveRadius(locations: KnownLocation[]): number {
  return _computeMinActiveRadius(locations);
}

export async function startLocationTracking(
  profile: 'low' | 'high' = 'low',
  minRadiusMeters: number = MAX_RADIUS_METERS
): Promise<void> {
  await LocationTracker.getInstance().startTracking(profile, minRadiusMeters);
}

export async function stopLocationTracking(): Promise<void> {
  await LocationTracker.getInstance().stopTracking();
}

export async function switchLocationProfile(
  profile: 'low' | 'high',
  minRadiusMeters: number
): Promise<void> {
  await LocationTracker.getInstance().switchProfile(profile, minRadiusMeters);
}

export function _resetGPSStateForTesting(): void {
  LocationTracker.getInstance().resetForTesting();
}

export async function autoDetectLocations(): Promise<void> {
  await _autoDetectLocations();
}
