import { Platform, Linking } from 'react-native';
import {
  initialize,
  openHealthConnectSettings,
  getGrantedPermissions,
} from 'react-native-health-connect';

const APP_PACKAGE_NAME = 'com.jollyheron.touchgrass';
const HEALTH_CONNECT_PLAY_STORE_ID = 'com.google.android.apps.healthdata';

/**
 * Open Health Connect settings via the most reliable method available.
 *
 * On Android 14+ (API 34+), Health Connect is integrated into the OS under
 * Settings → Security & Privacy → Privacy → Health Connect.
 *
 * Method 1: Open the main Health Connect settings page via the library's
 * native openHealthConnectSettings() which calls startActivity() directly.
 *
 * Method 2: Fallback — deep-link directly to the TouchGrass permissions page
 * using the MANAGE_HEALTH_PERMISSIONS intent URI (requires manifest <queries>
 * declaration). Note: React Native's Linking.openURL() wraps URLs in
 * ACTION_VIEW rather than calling Intent.parseUri(), so this path only works
 * on devices/RN versions that handle intent: schemes via ACTION_VIEW.
 *
 * On Android 13 and below, Health Connect is a standalone app. The custom
 * scheme is tried first; if unavailable the Play Store is opened so the user
 * can install it.
 *
 * @returns true if Health Connect was opened successfully, false otherwise
 */
export async function openHealthConnectPermissionsViaIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('Health Connect is only available on Android');
    return false;
  }

  const apiLevel =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10) || 0;

  try {
    if (apiLevel >= 34) {
      // Android 14+ (API 34+): Health Connect is built into the OS.

      // Method 1: Open the main Health Connect settings page via the native library.
      // Uses startActivity() directly — the most reliable approach on API 34+.
      try {
        openHealthConnectSettings();
        return true;
      } catch (e) {
        console.warn('openHealthConnectSettings failed:', e);
      }

      // Method 2: Deep-link directly to the TouchGrass permissions page.
      // Fallback for devices where the library call fails. Note: Linking.openURL()
      // wraps the URL in ACTION_VIEW rather than using Intent.parseUri(), so this
      // may not work on all devices.
      try {
        const permissionsUrl = `intent:#Intent;action=android.health.connect.action.MANAGE_HEALTH_PERMISSIONS;S.android.intent.extra.PACKAGE_NAME=${APP_PACKAGE_NAME};end`;
        await Linking.openURL(permissionsUrl);
        return true;
      } catch (e) {
        console.warn('MANAGE_HEALTH_PERMISSIONS intent failed:', e);
      }
    } else {
      // Android 13 and below: Health Connect is a standalone app.
      // Method 1: Try direct app launch via the custom scheme.
      try {
        const appUrl = 'healthconnect://';
        const canOpenApp = await Linking.canOpenURL(appUrl);
        if (canOpenApp) {
          await Linking.openURL(appUrl);
          return true;
        }
      } catch (e) {
        console.warn('Custom scheme failed:', e);
      }

      // Method 2: Open the Play Store via the market:// scheme.
      try {
        const playStoreUrl = `market://details?id=${HEALTH_CONNECT_PLAY_STORE_ID}`;
        const canOpenMarket = await Linking.canOpenURL(playStoreUrl);
        if (canOpenMarket) {
          await Linking.openURL(playStoreUrl);
          return true;
        }
      } catch (e) {
        console.warn('Play Store market URL failed:', e);
      }

      // Method 3: Play Store via browser as a last resort.
      try {
        await Linking.openURL(
          `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PLAY_STORE_ID}`
        );
        return true;
      } catch (e) {
        console.warn('Browser Play Store URL failed:', e);
      }
    }

    console.warn('Health Connect could not be opened via any method');
    return false;
  } catch (error) {
    console.error('Error opening Health Connect:', error);
    return false;
  }
}

/**
 * Verify Health Connect permissions using the granted-permissions API.
 * This is a fast check that does not read any health data.
 *
 * @returns true if the required read permissions are granted, false otherwise
 */
export async function verifyHealthConnectPermissions(): Promise<boolean> {
  try {
    await initialize();
    const granted = await getGrantedPermissions();
    // Require both ExerciseSession and Steps read access.
    const hasExercise = granted.some(
      (p) => p.accessType === 'read' && p.recordType === 'ExerciseSession'
    );
    const hasSteps = granted.some((p) => p.accessType === 'read' && p.recordType === 'Steps');

    return hasExercise && hasSteps;
  } catch (error) {
    console.warn('Health Connect permission check error:', error);
    return false;
  }
}
