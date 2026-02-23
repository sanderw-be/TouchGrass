import { Platform, Linking } from 'react-native';
import {
  initialize,
  openHealthConnectSettings,
  readRecords,
} from 'react-native-health-connect';

const APP_PACKAGE_NAME = 'com.sanderwubben.touchgrass';
const HEALTH_CONNECT_PLAY_STORE_ID = 'com.google.android.apps.healthdata';

/**
 * Open Health Connect settings via the most reliable method available.
 *
 * On Android 14+ (API 34+), Health Connect is integrated into the OS under
 * Settings → Security & Privacy → Privacy → Health Connect.
 *
 * Method 1: Deep-link directly to the TouchGrass permissions page using the
 * MANAGE_HEALTH_PERMISSIONS intent (requires manifest <queries> declaration).
 * React Native's Linking module parses intent: URIs via Intent.parseUri with
 * URI_INTENT_SCHEME, which calls startActivity() natively.
 *
 * Method 2: Fall back to the main Health Connect settings page via the library's
 * native openHealthConnectSettings() which uses startActivity() directly.
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

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : (parseInt(Platform.Version, 10) || 0);

  try {
    if (apiLevel >= 34) {
      // Android 14+ (API 34+): Health Connect is built into the OS.

      // Method 1: Deep-link to the TouchGrass-specific permissions page.
      // React Native parses intent: URIs via Intent.parseUri (URI_INTENT_SCHEME).
      // Note: canOpenURL is intentionally skipped — it returns false for intent: URIs
      // even when the target activity exists.
      try {
        const permissionsUrl = `intent:#Intent;action=android.health.connect.action.MANAGE_HEALTH_PERMISSIONS;S.android.intent.extra.PACKAGE_NAME=${APP_PACKAGE_NAME};end`;
        await Linking.openURL(permissionsUrl);
        console.log('Opened Health Connect permissions via MANAGE_HEALTH_PERMISSIONS');
        return true;
      } catch (e) {
        console.log('MANAGE_HEALTH_PERMISSIONS intent failed, trying main settings:', e);
      }

      // Method 2: Open the main Health Connect settings page.
      // (Settings → Security & Privacy → Privacy → Health Connect)
      try {
        openHealthConnectSettings();
        console.log('Opened Health Connect settings via native library');
        return true;
      } catch (e) {
        console.log('openHealthConnectSettings failed:', e);
      }
    } else {
      // Android 13 and below: Health Connect is a standalone app.
      // Method 1: Try direct app launch via the custom scheme.
      try {
        const appUrl = 'healthconnect://';
        const canOpenApp = await Linking.canOpenURL(appUrl);
        if (canOpenApp) {
          await Linking.openURL(appUrl);
          console.log('Opened Health Connect via custom scheme');
          return true;
        }
      } catch (e) {
        console.log('Custom scheme failed:', e);
      }

      // Method 2: Open the Play Store via the market:// scheme.
      try {
        const playStoreUrl = `market://details?id=${HEALTH_CONNECT_PLAY_STORE_ID}`;
        const canOpenMarket = await Linking.canOpenURL(playStoreUrl);
        if (canOpenMarket) {
          await Linking.openURL(playStoreUrl);
          console.log('Opened Health Connect in Play Store (market)');
          return true;
        }
      } catch (e) {
        console.log('Play Store market URL failed:', e);
      }

      // Method 3: Play Store via browser as a last resort.
      try {
        await Linking.openURL(`https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PLAY_STORE_ID}`);
        console.log('Opened Health Connect in Play Store (browser)');
        return true;
      } catch (e) {
        console.log('Browser Play Store URL failed:', e);
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
 * Verify Health Connect permissions by attempting to read data.
 * This is the most reliable way to check if permissions are granted,
 * as the library's permission check API doesn't work properly.
 * 
 * @returns true if permissions are granted and data can be read, false otherwise
 */
export async function verifyHealthConnectPermissions(): Promise<boolean> {
  try {
    await initialize();
    
    // Try to read a small dataset (last 1 day of exercise sessions)
    // If this succeeds, we have permissions
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const result = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: oneDayAgo.toISOString(),
        endTime: now.toISOString(),
      },
    });
    
    // If we got here without an error, permissions are granted
    // (even if there are no records, the read was successful)
    return true;
  } catch (error) {
    // If read fails, check if it's a permission error
    // Note: react-native-health-connect throws string errors, not structured error objects
    const errorMessage = String(error);
    const errorLower = errorMessage.toLowerCase();
    
    // Check for common permission-related error patterns
    const isPermissionError = 
      errorLower.includes('securityexception') ||
      errorLower.includes('permission') ||
      errorLower.includes('read_');
    
    if (isPermissionError) {
      console.log('Health Connect permissions not granted');
      return false;
    }
    
    // Other errors (e.g., Health Connect not available, network issues)
    // We treat these as "no permission" to be safe
    console.warn('Health Connect verification error:', error);
    return false;
  }
}
