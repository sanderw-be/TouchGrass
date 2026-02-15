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
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'StepsRecord' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    return granted.length > 0;
  } catch (e) {
    console.warn('Health Connect permission error:', e);
    return false;
  }
}

/**
 * Poll Health Connect for recent activity and submit any outside sessions found.
 * Called periodically by the background fetch task.
 */
export async function syncHealthConnect(): Promise<void> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return;

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
  } catch (e) {
    console.warn('Health Connect sync error:', e);
  }
}

/**
 * Exercise types that are very likely to be outdoors.
 * https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
 */
function isOutdoorExerciseType(type: number): boolean {
  const OUTDOOR_TYPES = [
    2,   // BIKING
    7,   // CRICKET
    9,   // HIKING
    13,  // FRISBEE_DISC
    14,  // GOLF
    16,  // RUNNING
    19,  // HANDBALL
    21,  // ICE_HOCKEY
    22,  // ICE_SKATING
    24,  // PADDLING
    25,  // PARAGLIDING
    28,  // ROCK_CLIMBING
    29,  // ROLLER_HOCKEY
    30,  // ROWING
    32,  // RUGBY
    33,  // SAILING
    34,  // SCUBA_DIVING
    35,  // SKATING
    36,  // SKIING
    37,  // WALKING
    38,  // SNOWBOARDING
    39,  // SNOWSHOEING
    40,  // SOCCER
    41,  // SOFTBALL
    47,  // SURFING
    48,  // SWIMMING_OPEN_WATER
    51,  // TENNIS
    52,  // VOLLEYBALL
    53,  // WALKING_NORDIC
    54,  // WATER_POLO
    58,  // AMERICAN_FOOTBALL
    59,  // AUSTRALIAN_FOOTBALL
    60,  // BADMINTON
    61,  // BASEBALL
    62,  // BASKETBALL
    63,  // KAYAKING
    64,  // PADDLE_BOARDING
    66,  // SKATEBOARDING
    67,  // SKIING_CROSS_COUNTRY
    68,  // SKIING_DOWNHILL
    69,  // SKIING_KITE
    70,  // SKIING_ROLLER
    71,  // SNOWMOBILE
    73,  // STANDUP_PADDLEBOARDING
    74,  // WHEELCHAIR_WALKING
  ];
  return OUTDOOR_TYPES.includes(type);
}
