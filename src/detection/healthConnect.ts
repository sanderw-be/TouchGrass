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
 * Request Health Connect permissions.
 * Returns true if granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    await initialize();
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    if (granted.length > 0) {
      setSetting(PERMISSION_WARNING_KEY, '0');
    }
    return granted.length > 0;
  } catch (e) {
    if (isPermissionError(e)) {
      logPermissionWarningOnce();
      return false;
    }
    console.warn('Health Connect permission error:', e);
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
  const message = String(error);
  return message.includes('SecurityException') && message.includes('READ_');
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
