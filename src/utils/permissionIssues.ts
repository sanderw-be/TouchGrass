import * as Notifications from 'expo-notifications';
import {
  getDetectionStatus,
  checkWeatherLocationPermissions,
  checkGPSPermissions,
  verifyHealthConnectPermissions,
  PermissionService,
} from '../detection';
import { getSettingAsync } from '../storage';
import { hasCalendarPermissions } from '../calendar/calendarService';

/**
 * Counts active permission issues across the app.
 *
 * - Settings issues: GPS enabled but permission missing; HC enabled but permission missing.
 * - Goals issues: weather enabled but location permission missing; calendar enabled but
 *   calendar permission missing; smart reminders enabled but notification permission missing.
 *
 * Used by AppNavigator to drive the red badge on the Goals and Settings tab icons.
 */
export async function countPermissionIssues(): Promise<{ goals: number; settings: number }> {
  const detection = await getDetectionStatus();

  // Perform live OS permission checks so that badge counts reflect the real
  // permission state even when permissions are changed outside the Settings
  // screen (e.g. via the Weather fix-flow on GoalsScreen, or vice-versa).
  const [gpsPermission, hcPermission, arPermission] = await Promise.all([
    detection.gps ? checkGPSPermissions() : Promise.resolve(false),
    detection.healthConnect ? verifyHealthConnectPermissions() : Promise.resolve(false),
    detection.activityRecognition
      ? PermissionService.checkActivityRecognitionPermissions()
      : Promise.resolve(false),
  ]);

  const settingsIssues =
    (detection.gps && !gpsPermission ? 1 : 0) +
    (detection.healthConnect && !hcPermission ? 1 : 0) +
    (detection.activityRecognition && !arPermission ? 1 : 0);

  let goalsIssues = 0;

  const weatherEnabled = (await getSettingAsync('weather_enabled', '1')) === '1';
  if (weatherEnabled) {
    const weatherOk = await checkWeatherLocationPermissions();
    if (!weatherOk) goalsIssues++;
  }

  const calendarEnabled = (await getSettingAsync('calendar_integration_enabled', '0')) === '1';
  if (calendarEnabled) {
    const calOk = await hasCalendarPermissions();
    if (!calOk) goalsIssues++;
  }

  const smartRemindersCount = parseInt(await getSettingAsync('smart_reminders_count', '2'), 10);
  if (smartRemindersCount > 0) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') goalsIssues++;
  }

  return { goals: goalsIssues, settings: settingsIssues };
}
