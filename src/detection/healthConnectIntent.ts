import { Platform, Linking } from 'react-native';
import { initialize, readRecords } from 'react-native-health-connect';

/**
 * Open Health Connect settings via Android Settings.
 * 
 * In newer Android versions (14+), Health Connect is integrated into Settings
 * under Settings → Privacy → Health Connect, rather than being a standalone app.
 * 
 * This function opens the Health Connect permission screen where TouchGrass
 * will appear after requestPermission() is called.
 * 
 * Flow:
 * 1. Open Android Settings → Health Connect
 * 2. User finds TouchGrass in the app list
 * 3. User taps TouchGrass and grants permissions
 * 4. User returns to TouchGrass (via back button)
 * 5. Verify permissions via data read
 * 
 * @returns true if Settings was opened successfully, false otherwise
 */
export async function openHealthConnectPermissionsViaIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('Health Connect is only available on Android');
    return false;
  }

  try {
    // For Android 14+ (where Health Connect is in Settings)
    // ACTION_HEALTH_CONNECT_SETTINGS opens Health Connect in Android Settings
    const healthConnectSettingsIntent = 'android.settings.HEALTH_CONNECT_SETTINGS';
    const settingsUrl = `intent:#Intent;action=${healthConnectSettingsIntent};end`;
    
    let opened = false;
    
    // Try opening Health Connect settings (Android 14+)
    try {
      const canOpenSettings = await Linking.canOpenURL(settingsUrl);
      if (canOpenSettings) {
        await Linking.openURL(settingsUrl);
        opened = true;
        console.log('Opened Health Connect via Settings Intent');
      }
    } catch (e) {
      console.log('Settings intent failed, trying fallback:', e);
    }
    
    // Fallback 1: Try the standalone Health Connect app (older Android versions)
    if (!opened) {
      try {
        const homeIntent = 'intent://healthconnect/home#Intent;package=com.google.android.apps.healthdata;end';
        const canOpenHome = await Linking.canOpenURL(homeIntent);
        if (canOpenHome) {
          await Linking.openURL(homeIntent);
          opened = true;
          console.log('Opened Health Connect standalone app');
        }
      } catch (e) {
        console.log('Home intent failed, trying package URL:', e);
      }
    }
    
    // Fallback 2: Open app info page
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
    
    if (!opened) {
      console.warn('Health Connect settings could not be opened');
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
