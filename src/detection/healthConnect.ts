import {
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  getSdkStatus,
} from 'react-native-health-connect';
import { getSetting, setSetting } from '../storage/database';
import { submitSession, buildSession } from './sessionMerger';

// Activities that strongly suggest being outside
const OUTDOOR_ACTIVITY_TYPES = [
  'ExerciseSession', // walking, running, cycling etc.
  'StepsRecord',
];

const CONFIDENCE_ACTIVITY = 0.70;
const CONFIDENCE_STEPS = 0.50; // Lower confidence for steps (could be indoor)
const MIN_DURATION_MS = 5 * 60 * 1000; // ignore sessions under 5 minutes
const PERMISSION_WARNING_KEY = 'healthconnect_permission_warning';

/**
 * Check if Health Connect is available on this device.
 */
export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Check if Health Connect permissions are actually granted.
 * Performs a test read to verify permissions work.
 * Returns true if permissions are valid and working.
 */
export async function checkHealthConnectPermissions(): Promise<boolean> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) {
      console.log('Health Connect: SDK not available');
      return false;
    }

    console.log('Health Connect: Initializing SDK...');
    await initialize();
    console.log('Health Connect: SDK initialized successfully');

    // Perform a test read with minimal time range to verify permissions
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const startTimeISO = new Date(oneDayAgo).toISOString();
    const endTimeISO = new Date(now).toISOString();

    console.log('Health Connect: Testing ExerciseSession permissions...');
    // Try to read ExerciseSession records (this will fail if permissions not granted)
    const result = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startTimeISO,
        endTime: endTimeISO,
      },
    });
    console.log(`Health Connect: ExerciseSession read successful (${result.records.length} records)`);

    // If we got here without error, permissions are valid
    setSetting('healthconnect_enabled', '1');
    setSetting(PERMISSION_WARNING_KEY, '0');
    console.log('Health Connect: Permissions verified and enabled');
    return true;
  } catch (e) {
    const errorMsg = String(e);
    console.error('Health Connect permission check error:', errorMsg);
    
    if (isPermissionError(e)) {
      console.warn('Health Connect: Permission error detected, disabling');
      setSetting('healthconnect_enabled', '0');
      return false;
    }
    // Other errors (e.g., network) shouldn't change permission state
    console.warn('Health Connect: Non-permission error, not changing state');
    // Don't change the permission state on non-permission errors
    // Return false to indicate check failed, but keep existing state
    return getSetting('healthconnect_enabled', '0') === '1';
  }
}

/**
 * Request Health Connect permissions.
 * Returns true if granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    console.log('Health Connect: Requesting permissions...');
    await initialize();
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    console.log('Health Connect: Permissions granted:', granted);
    if (granted.length > 0) {
      setSetting(PERMISSION_WARNING_KEY, '0');
      setSetting('healthconnect_enabled', '1');
      return true;
    }
    console.log('Health Connect: No permissions granted');
    setSetting('healthconnect_enabled', '0');
    return false;
  } catch (e) {
    console.error('Health Connect permission request error:', e);
    if (isPermissionError(e)) {
      logPermissionWarningOnce();
      setSetting('healthconnect_enabled', '0');
      return false;
    }
    console.warn('Health Connect permission error:', e);
    setSetting('healthconnect_enabled', '0');
    return false;
  }
}

/**
 * Poll Health Connect for recent activity and submit any outside sessions found.
 * Called periodically by the background fetch task.
 */
export async function syncHealthConnect(): Promise<boolean> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return false;

    await initialize();

    // Only fetch since last sync
    const lastSync = parseInt(getSetting('healthconnect_last_sync', '0'), 10);
    const now = Date.now();
    const startTime = lastSync > 0 ? lastSync : now - 7 * 24 * 60 * 60 * 1000; // default: last 7 days

    const startTimeISO = new Date(startTime).toISOString();
    const endTimeISO = new Date(now).toISOString();

    // Read exercise sessions
    const exerciseResult = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startTimeISO,
        endTime: endTimeISO,
      },
    });

    for (const record of exerciseResult.records) {
      const start = new Date(record.startTime).getTime();
      const end = new Date(record.endTime).getTime();
      const duration = end - start;

      if (duration < MIN_DURATION_MS) continue;

      // Boost confidence for explicitly outdoor exercise types
      const isExplicitlyOutdoor = isOutdoorExerciseType(record.exerciseType);
      const confidence = isExplicitlyOutdoor ? 0.80 : CONFIDENCE_ACTIVITY;

      const session = buildSession(
        start,
        end,
        'health_connect',
        confidence,
        `Exercise type: ${record.exerciseType}`,
      );

      submitSession(session);
    }

    // Read steps records
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startTimeISO,
        endTime: endTimeISO,
      },
    });

    for (const record of stepsResult.records) {
      const start = new Date(record.startTime).getTime();
      const end = new Date(record.endTime).getTime();
      const duration = end - start;

      if (duration < MIN_DURATION_MS) continue;

      // Steps have lower confidence than explicit exercise sessions
      // as they could be indoor (mall, treadmill, etc.)
      const confidence = CONFIDENCE_STEPS;

      const session = buildSession(
        start,
        end,
        'health_connect',
        confidence,
        `Steps: ${record.count}`,
      );

      submitSession(session);
    }

    // Update last sync timestamp
    setSetting('healthconnect_last_sync', String(now));
    return true;
  } catch (e) {
    if (isPermissionError(e)) {
      logPermissionWarningOnce();
      setSetting('healthconnect_enabled', '0');
      return false;
    }
    console.warn('Health Connect sync error:', e);
    return false;
  }
}

function isPermissionError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  console.log('Checking if permission error:', message.substring(0, 200));
  
  // Detect various permission-related exceptions
  // Be specific to avoid false positives while catching common error formats
  const isPermError = (
    message.includes('securityexception') ||
    message.includes('permissiondenied') ||
    message.includes('permission denied') ||
    message.includes('unsupportedoperationexception') ||
    message.includes('access_denied') ||
    message.includes('permission_denied') ||
    (message.includes('permission') && message.includes('denied'))
  );
  
  console.log('Is permission error:', isPermError);
  return isPermError;
}

function logPermissionWarningOnce(): void {
  const alreadyLogged = getSetting(PERMISSION_WARNING_KEY, '0') === '1';
  if (alreadyLogged) return;
  console.warn('Health Connect permissions missing. Reconnect in Settings.');
  setSetting(PERMISSION_WARNING_KEY, '1');
}

/**
 * Exercise types that are very likely to be outdoors.
 * Criteria: Activities that primarily or commonly occur outdoors.
 * Excludes indoor-specific activities (treadmill, stationary bike, gym equipment)
 * and ambiguous activities (yoga, stretching, strength training).
 * https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
 */
function isOutdoorExerciseType(type: number): boolean {
  const OUTDOOR_TYPES = [
    2,   // BADMINTON
    4,   // BASEBALL
    5,   // BASKETBALL
    8,   // BIKING
    14,  // CRICKET
    28,  // FOOTBALL_AMERICAN
    29,  // FOOTBALL_AUSTRALIAN
    31,  // FRISBEE_DISC
    32,  // GOLF
    35,  // HANDBALL
    37,  // HIKING
    38,  // ICE_HOCKEY
    39,  // ICE_SKATING
    46,  // PADDLING
    47,  // PARAGLIDING
    51,  // ROCK_CLIMBING
    52,  // ROLLER_HOCKEY
    53,  // ROWING
    55,  // RUGBY
    56,  // RUNNING
    58,  // SAILING
    59,  // SCUBA_DIVING
    60,  // SKATING
    61,  // SKIING
    62,  // SNOWBOARDING
    63,  // SNOWSHOEING
    64,  // SOCCER
    65,  // SOFTBALL
    72,  // SURFING
    73,  // SWIMMING_OPEN_WATER
    76,  // TENNIS
    78,  // VOLLEYBALL
    79,  // WALKING
    80,  // WATER_POLO
    82,  // WHEELCHAIR
  ];
  return OUTDOOR_TYPES.includes(type);
}
