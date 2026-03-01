import {
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  getSdkStatus,
} from 'react-native-health-connect';
import { getSetting, setSetting } from '../storage/database';
import { submitSession, buildSession } from './sessionMerger';
import { openHealthConnectPermissionsViaIntent, verifyHealthConnectPermissions } from './healthConnectIntent';

// Activities that strongly suggest being outside
const OUTDOOR_ACTIVITY_TYPES = [
  'ExerciseSession', // walking, running, cycling etc.
  'StepsRecord',
];

const CONFIDENCE_ACTIVITY = 0.70;
export const MIN_DURATION_MS = 5 * 60 * 1000; // ignore sessions under 5 minutes
// Average walking cadence at 5 km/h (~110 steps/min); used to estimate walk
// duration from step count when the recorded time window is unreliably short
// (e.g. batch-synced records from Google Fit).
export const STEPS_PER_MINUTE_AT_5KMH = 110;
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
 * Request Health Connect permissions using a hybrid approach.
 * 
 * With expo-health-connect config plugin, the HealthConnectPermissionDelegate 
 * is properly initialized, so requestPermission() should work correctly.
 * 
 * Flow:
 * 1. Check if permissions are already granted
 * 2. Try library's requestPermission() - should now work with expo-health-connect plugin
 * 3. If that fails or doesn't show dialog, fall back to Intent-based flow
 * 4. Verification happens when app returns to foreground (via recheckHealthConnect)
 * 
 * Returns true if permissions were granted OR Settings was opened successfully.
 * Returns false if both methods failed.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    await initialize();
    
    // First, check if permissions are already granted
    const alreadyGranted = await verifyHealthConnectPermissions();
    if (alreadyGranted) {
      setSetting(PERMISSION_WARNING_KEY, '0');
      return true;
    }
    
    // Try the library's requestPermission() first
    // With expo-health-connect plugin, this should work properly
    try {
      const granted = await requestPermission([
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'Steps' as any },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'Distance' },
      ]);
      
      // Check if permissions were granted
      if (granted && granted.length > 0) {
        setSetting(PERMISSION_WARNING_KEY, '0');
        return true;
      }
      
      // If no permissions granted, fall back to Intent flow
      console.log('requestPermission returned empty, trying Intent fallback');
    } catch (permError) {
      // If requestPermission fails, fall back to manual flow
      console.log('Library requestPermission failed, using Intent fallback:', permError);
    }
    
    // Fallback: Open Health Connect Settings so user can manually grant permissions
    const opened = await openHealthConnectPermissionsViaIntent();
    if (!opened) {
      console.warn('Could not open Health Connect settings');
      return false;
    }
    
    // Successfully opened Health Connect - user will grant permissions there
    // Verification will happen when the app returns to foreground
    return true;
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
 * Open Health Connect settings for managing existing permissions.
 * 
 * This function opens Health Connect directly without trying requestPermission().
 * The user can then navigate to TouchGrass within Health Connect to manage permissions.
 * 
 * Use this for the "Manage permissions" button after initial connection.
 * 
 * Returns true if Health Connect was opened successfully.
 */
export async function openHealthConnectForManagement(): Promise<boolean> {
  try {
    await initialize();
    
    // Skip requestPermission() - it's not working reliably even with expo-health-connect
    // Just open Health Connect directly via Intent
    const opened = await openHealthConnectPermissionsViaIntent();
    if (!opened) {
      console.warn('Could not open Health Connect settings');
      return false;
    }
    
    return true;
  } catch (e) {
    console.warn('Health Connect open for management error:', e);
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

    console.log(`TouchGrass: Health Connect - ${exerciseResult.records.length} exercise session(s) received`);

    for (const [i, record] of exerciseResult.records.entries()) {
      const start = new Date(record.startTime).getTime();
      const end = new Date(record.endTime).getTime();
      const duration = end - start;

      if (duration < MIN_DURATION_MS) {
        console.log(`TouchGrass: HC exercise[${i}] skipped - too short (${Math.round(duration / 60000)} min): type=${record.exerciseType} ${record.startTime} – ${record.endTime}`);
        continue;
      }

      // Boost confidence for explicitly outdoor exercise types
      const isExplicitlyOutdoor = isOutdoorExerciseType(record.exerciseType);
      const confidence = isExplicitlyOutdoor ? 0.80 : CONFIDENCE_ACTIVITY;

      console.log(`TouchGrass: HC exercise[${i}]: type=${record.exerciseType} start=${record.startTime} end=${record.endTime} duration=${Math.round(duration / 60000)} min confidence=${confidence.toFixed(2)}`);

      const session = buildSession(
        start,
        end,
        'health_connect',
        confidence,
        `Exercise type: ${record.exerciseType}`,
      );

      submitSession(session);
    }

    // Also read step-count records — Google Fit writes auto-detected walks here
    // even when they are not tracked as explicit ExerciseSession entries.
    try {
      const stepsResult = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTimeISO,
          endTime: endTimeISO,
        },
      });

      console.log(`TouchGrass: Health Connect - ${stepsResult.records.length} steps record(s) received`);

      for (const [i, record] of stepsResult.records.entries()) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        const recordedDuration = end - start;

        // Estimate duration from step count at average walking pace (5 km/h).
        // Health Connect sometimes batch-syncs steps with an inaccurately short
        // time window; the step-based estimate lets us recover those sessions.
        const estimatedDurationMs = (record.count / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
        const effectiveDurationMs = Math.max(recordedDuration, estimatedDurationMs);

        // Require at least 5 min (effective) and a meaningful step count (>= 500)
        // to filter out short bursts of indoor movement.
        if (record.count < 500 || effectiveDurationMs < MIN_DURATION_MS) {
          const reason = record.count < 500
            ? `too few steps (${record.count})`
            : `too short (${Math.round(effectiveDurationMs / 60000)} min effective)`;
          console.log(`TouchGrass: HC steps[${i}] skipped - ${reason}: ${record.startTime} – ${record.endTime}`);
          continue;
        }

        const sessionStart = end - effectiveDurationMs;
        console.log(`TouchGrass: HC steps[${i}]: ${record.count} steps start=${new Date(sessionStart).toISOString()} end=${record.endTime} duration=${Math.round(effectiveDurationMs / 60000)} min`);

        // Use the recorded end time (when batch-sync writes the record) and
        // extend backwards so the session covers the full estimated walk.
        const session = buildSession(
          sessionStart,
          end,
          'health_connect',
          CONFIDENCE_ACTIVITY,
          `Steps: ${record.count}`,
        );

        submitSession(session);
      }
    } catch (stepsError) {
      // Steps reading is supplementary — don't fail the whole sync if it errors
      if (!isPermissionError(stepsError)) {
        console.warn('Health Connect steps sync error:', stepsError);
      }
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
    // Transient errors (network, API unavailable, etc.) should not permanently
    // disable Health Connect — just return false and retry next time.
    console.warn('Health Connect sync error:', e);
    return false;
  }
}

function isPermissionError(error: unknown): boolean {
  const message = String(error);
  return message.includes('SecurityException') &&
    (message.includes('READ_') || message.toLowerCase().includes('permission'));
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
