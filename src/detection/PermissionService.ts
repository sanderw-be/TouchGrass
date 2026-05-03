import * as Location from 'expo-location';
import { initialize, requestPermission } from 'react-native-health-connect';
import { PermissionsAndroid, Permission, Platform } from 'react-native';
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
  public static async requestLocationPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }> {
    // 1. Check Foreground
    const { status: currentFg } = await Location.getForegroundPermissionsAsync();

    if (currentFg !== 'granted') {
      const { status: fg, canAskAgain: fgCanAsk } =
        await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return { granted: false, canAskAgain: fgCanAsk };
    }

    // 2. Check Background
    const { status: currentBg, canAskAgain: bgCanAskAgain } =
      await Location.getBackgroundPermissionsAsync();
    if (currentBg === 'granted') {
      return { granted: true, canAskAgain: bgCanAskAgain };
    }

    // 3. Request Background (sequentially as required by Android 11+)
    const { status: bg, canAskAgain: bgCanAsk } =
      await Location.requestBackgroundPermissionsAsync();
    return { granted: bg === 'granted', canAskAgain: bgCanAsk };
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
      const { status: current } = await Location.getForegroundPermissionsAsync();
      if (current === 'granted') return true;

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

  public static async checkActivityRecognitionPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel =
        typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
      if (apiLevel < 29) return true; // Granted at install time before Android 10

      const permissionsMap = PermissionsAndroid.PERMISSIONS as Record<string, string>;
      const perm = (permissionsMap.ACTIVITY_RECOGNITION ||
        'android.permission.ACTIVITY_RECOGNITION') as Permission;
      return await PermissionsAndroid.check(perm);
    } catch (e) {
      console.warn('Activity Recognition permission check error:', e);
      return false;
    }
  }

  public static async requestActivityRecognitionPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }> {
    if (Platform.OS !== 'android') return { granted: true, canAskAgain: true };

    try {
      const apiLevel =
        typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
      if (apiLevel < 29) return { granted: true, canAskAgain: true };

      const permissionsMap = PermissionsAndroid.PERMISSIONS as Record<string, string>;
      const perm = (permissionsMap.ACTIVITY_RECOGNITION ||
        'android.permission.ACTIVITY_RECOGNITION') as Permission;

      const isGranted = await PermissionsAndroid.check(perm);
      if (isGranted) return { granted: true, canAskAgain: true };

      const result = await PermissionsAndroid.request(perm);
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      const canAskAgain = result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
      return { granted, canAskAgain };
    } catch (e) {
      console.warn('Activity Recognition permission request error:', e);
      return { granted: false, canAskAgain: true };
    }
  }
}
