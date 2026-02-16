import { Platform, Linking } from 'react-native';
import { initialize, readRecords } from 'react-native-health-connect';

/**
 * Open Health Connect settings via the most reliable method available.
 * 
 * In newer Android versions (14+), Health Connect is integrated into Settings
 * under Settings → Privacy → Health Connect, rather than being a standalone app.
 * 
 * This function tries multiple approaches to open Health Connect:
 * 1. Direct app launch (most reliable)
 * 2. Settings Intent (Android 14+)
 * 3. App info page (always works as last resort)
 * 
 * @returns true if Health Connect was opened successfully, false otherwise
 */
export async function openHealthConnectPermissionsViaIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('Health Connect is only available on Android');
    return false;
  }

  try {
    let opened = false;
    
    // Method 1: Try direct app launch via custom scheme
    // This is most likely to work if Health Connect is installed
    if (!opened) {
      try {
        const appUrl = 'healthconnect://';
        const canOpenApp = await Linking.canOpenURL(appUrl);
        if (canOpenApp) {
          await Linking.openURL(appUrl);
          opened = true;
          console.log('Opened Health Connect via custom scheme');
        }
      } catch (e) {
        console.log('Custom scheme failed:', e);
      }
    }
    
    // Method 2: Try Settings Intent (Android 14+)
    if (!opened) {
      try {
        const settingsUrl = 'intent:#Intent;action=android.settings.HEALTH_CONNECT_SETTINGS;end';
        const canOpenSettings = await Linking.canOpenURL(settingsUrl);
        if (canOpenSettings) {
          await Linking.openURL(settingsUrl);
          opened = true;
          console.log('Opened Health Connect via Settings Intent');
        }
      } catch (e) {
        console.log('Settings intent failed:', e);
      }
    }
    
    // Method 3: Try opening the Health Connect app directly
    if (!opened) {
      try {
        const packageUrl = 'package:com.google.android.apps.healthdata';
        const canOpenPackage = await Linking.canOpenURL(packageUrl);
        if (canOpenPackage) {
          await Linking.openURL(packageUrl);
          opened = true;
          console.log('Opened Health Connect app info');
        }
      } catch (e) {
        console.log('Package URL failed:', e);
      }
    }
    
    // Method 4: Try Play Store link as last resort
    if (!opened) {
      try {
        const playStoreUrl = 'market://details?id=com.google.android.apps.healthdata';
        const canOpenMarket = await Linking.canOpenURL(playStoreUrl);
        if (canOpenMarket) {
          await Linking.openURL(playStoreUrl);
          opened = true;
          console.log('Opened Health Connect in Play Store');
        }
      } catch (e) {
        console.log('Play Store URL failed:', e);
      }
    }
    
    if (!opened) {
      console.warn('Health Connect could not be opened via any method');
      return false;
    }
    
    return true;
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
