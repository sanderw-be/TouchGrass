import * as Notifications from 'expo-notifications';
import { getDetectionStatus, checkWeatherLocationPermissions } from '../detection';
import { getSetting } from '../storage/database';
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
  const detection = getDetectionStatus();

  const settingsIssues =
    (detection.gps && !detection.gpsPermission ? 1 : 0) +
    (detection.healthConnect && !detection.healthConnectPermission ? 1 : 0);

  let goalsIssues = 0;

  const weatherEnabled = getSetting('weather_enabled', '1') === '1';
  if (weatherEnabled) {
    const weatherOk = await checkWeatherLocationPermissions();
    if (!weatherOk) goalsIssues++;
  }

  const calendarEnabled = getSetting('calendar_integration_enabled', '0') === '1';
  if (calendarEnabled) {
    const calOk = await hasCalendarPermissions();
    if (!calOk) goalsIssues++;
  }

  const smartRemindersCount = parseInt(getSetting('smart_reminders_count', '2'), 10);
  if (smartRemindersCount > 0) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') goalsIssues++;
  }

  return { goals: goalsIssues, settings: settingsIssues };
}
