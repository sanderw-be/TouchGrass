import { HealthSessionBuilder } from './HealthSessionBuilder';
import { PermissionService } from './PermissionService';

export {
  CONFIDENCE_ACTIVITY,
  MIN_DURATION_MS,
  STEPS_PER_MINUTE_AT_5KMH,
  STEPS_PER_MIN_AT_2_5KMH,
  STEPS_PER_MIN_AT_4KMH,
} from './constants';

export async function isHealthConnectAvailable(): Promise<boolean> {
  // Use the permission service to check availability to avoid direct library calls here
  // or use the static method from PermissionService if it exists.
  // Actually, PermissionService doesn't have it yet. Let's just do it cleanly.
  try {
    const { getSdkStatus, SdkAvailabilityStatus } = await import('react-native-health-connect');
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  return PermissionService.requestHealthPermissions();
}

export async function openHealthConnectForManagement(): Promise<boolean> {
  return PermissionService.openHealthConnectSettings();
}

export async function syncHealthConnect(): Promise<boolean> {
  return HealthSessionBuilder.syncHealthConnect();
}
