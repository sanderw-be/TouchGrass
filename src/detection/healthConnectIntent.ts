import { Platform, Linking } from 'react-native';
import { initialize, readRecords } from 'react-native-health-connect';

/**
 * Launch Health Connect app directly to grant permissions.
 * Works around library limitation by using Intent-based flow.
 * 
 * Flow:
 * 1. Open Health Connect app via Intent
 * 2. User grants permissions in Health Connect
 * 3. Return to TouchGrass
 * 4. Verify permissions via data read
 * 
 * @returns true if Health Connect was opened successfully, false otherwise
 */
export async function openHealthConnectPermissionsViaIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('Health Connect is only available on Android');
    return false;
  }

  try {
    // Intent URL to open Health Connect app
    // This opens the Health Connect app where users can manage permissions
    const healthConnectIntent = 'intent://app/health-connect#Intent;scheme=health;package=com.google.android.apps.healthdata;end';
    
    const canOpen = await Linking.canOpenURL(healthConnectIntent);
    if (canOpen) {
      await Linking.openURL(healthConnectIntent);
      return true;
    } else {
      // Fallback: Try to open via package name
      const packageUrl = 'package:com.google.android.apps.healthdata';
      const canOpenPackage = await Linking.canOpenURL(packageUrl);
      if (canOpenPackage) {
        await Linking.openURL(packageUrl);
        return true;
      }
      
      console.warn('Health Connect app not found');
      return false;
    }
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
