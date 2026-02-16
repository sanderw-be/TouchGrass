import { Platform, Linking } from 'react-native';
import { initialize, readRecords } from 'react-native-health-connect';

/**
 * Open Health Connect app so user can manually grant permissions.
 * 
 * After calling the library's requestPermission() (which registers the app but doesn't show dialog),
 * this opens Health Connect where TouchGrass will appear in the app list.
 * 
 * Flow:
 * 1. Open Health Connect app main screen
 * 2. User finds TouchGrass in the app list
 * 3. User taps TouchGrass and grants permissions
 * 4. User returns to TouchGrass
 * 5. Verify permissions via data read
 * 
 * @returns true if Health Connect was opened successfully, false otherwise
 */
export async function openHealthConnectPermissionsViaIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('Health Connect is only available on Android');
    return false;
  }

  try {
    // Try different Intent URLs to open Health Connect
    // Intent 1: Open Health Connect home screen (where apps are listed)
    const homeIntent = 'intent://healthconnect/home#Intent;package=com.google.android.apps.healthdata;end';
    
    let opened = false;
    
    // Try home intent first
    try {
      const canOpenHome = await Linking.canOpenURL(homeIntent);
      if (canOpenHome) {
        await Linking.openURL(homeIntent);
        opened = true;
      }
    } catch (e) {
      console.log('Home intent failed, trying fallback');
    }
    
    // If home intent didn't work, try package URL (opens app info)
    if (!opened) {
      const packageUrl = 'package:com.google.android.apps.healthdata';
      try {
        const canOpenPackage = await Linking.canOpenURL(packageUrl);
        if (canOpenPackage) {
          await Linking.openURL(packageUrl);
          opened = true;
        }
      } catch (e) {
        console.log('Package URL failed');
      }
    }
    
    if (!opened) {
      console.warn('Health Connect app not found or could not be opened');
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
