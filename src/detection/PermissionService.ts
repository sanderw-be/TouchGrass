import * as Location from 'expo-location';
import { initialize, requestPermission } from 'react-native-health-connect';
import { setSettingAsync } from '../storage';
import {
  openHealthConnectPermissionsViaIntent,
  verifyHealthConnectPermissions,
} from './healthConnectIntent';

const PERMISSION_WARNING_KEY = 'healthconnect_permission_warning';

export class PermissionService {
  /**
   * Request location permissions (foreground + background).
   */
  public static async requestLocationPermissions(): Promise<boolean> {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    return bg === 'granted';
  }

  /**
   * Request Health Connect permissions using a hybrid approach.
   */
  public static async requestHealthPermissions(): Promise<boolean> {
    try {
      await initialize();

      const alreadyGranted = await verifyHealthConnectPermissions();
      if (alreadyGranted) {
        await setSettingAsync(PERMISSION_WARNING_KEY, '0');
        return true;
      }

      try {
        const granted = await requestPermission([
          { accessType: 'read', recordType: 'ExerciseSession' },
          { accessType: 'read', recordType: 'Steps' },
        ]);

        if (granted && Array.isArray(granted) && granted.length > 0) {
          await setSettingAsync(PERMISSION_WARNING_KEY, '0');
          return true;
        }

        const nowGranted = await verifyHealthConnectPermissions();
        if (nowGranted) {
          await setSettingAsync(PERMISSION_WARNING_KEY, '0');
          return true;
        }
      } catch (permError) {
        console.warn('Library requestPermission failed, using Intent fallback:', permError);
      }

      const opened = await openHealthConnectPermissionsViaIntent();
      return opened;
    } catch (e) {
      console.warn('Health Connect permission error:', e);
      return false;
    }
  }

  /**
   * Check whether foreground location permission is granted for weather.
   */
  public static async checkWeatherLocationPermissions(): Promise<boolean> {
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
   */
  public static async requestWeatherLocationPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('Weather location permission request error:', e);
      return false;
    }
  }

  public static async verifyHealthConnectPermissions(): Promise<boolean> {
    return verifyHealthConnectPermissions();
  }

  public static async openHealthConnectSettings(): Promise<boolean> {
    return openHealthConnectPermissionsViaIntent();
  }
}
