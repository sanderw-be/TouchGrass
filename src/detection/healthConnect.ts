import {
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  getSdkStatus,
} from 'react-native-health-connect';
import { getSetting, setSetting, pruneShortDiscardedHealthConnectSessions, getKnownLocations } from '../storage/database';
import { submitSession, buildSession } from './sessionMerger';
import { openHealthConnectPermissionsViaIntent, verifyHealthConnectPermissions } from './healthConnectIntent';
import { t } from '../i18n';
import { useImperialUnits, kmhToMph } from '../utils/units';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';

// Activities that strongly suggest being outside
const OUTDOOR_ACTIVITY_TYPES = [
  'ExerciseSession', // walking, running, cycling etc.
  'StepsRecord',
];

export const CONFIDENCE_ACTIVITY = 0.70;
export const MIN_DURATION_MS = 5 * 60 * 1000; // ignore sessions under 5 minutes
// Average walking cadence at 5 km/h (~110 steps/min); used to estimate walk
// duration from step count when the recorded time window is unreliably short
// (e.g. batch-synced records from Google Fit).
export const STEPS_PER_MINUTE_AT_5KMH = 110;
// The walking speed (km/h) corresponding to the baseline cadence above.
const BASELINE_SPEED_KMH = 5;
// Speed-based step-rate thresholds. Below 2.5 km/h is too slow to be real
// outdoor walking (skip the record entirely); between 2.5 and 4 km/h is slow
// but plausible (submit with reduced confidence).
export const STEPS_PER_MIN_AT_2_5KMH = Math.round(STEPS_PER_MINUTE_AT_5KMH * 0.5); // 55
export const STEPS_PER_MIN_AT_4KMH   = Math.round(STEPS_PER_MINUTE_AT_5KMH * 0.8); // 88
const CONFIDENCE_SLOW_WALK = 0.50; // 2.5–4 km/h: plausible but below normal pace
const PERMISSION_WARNING_KEY = 'healthconnect_permission_warning';

const EARTH_RADIUS_METERS = 6_371_000;

/** Haversine distance between two GPS coordinates in metres. */
function haversineDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
      
      // Check if permissions were granted via the dialog
      if (granted && Array.isArray(granted) && granted.length > 0) {
        setSetting(PERMISSION_WARNING_KEY, '0');
        return true;
      }
      
      // requestPermission() can return null/empty when permissions are already granted
      // (e.g. some devices return null instead of the full list). Re-verify before
      // falling back to the Intent flow.
      const nowGranted = await verifyHealthConnectPermissions();
      if (nowGranted) {
        setSetting(PERMISSION_WARNING_KEY, '0');
        return true;
      }
    } catch (permError) {
      // If requestPermission fails, fall back to manual flow
      console.warn('Library requestPermission failed, using Intent fallback:', permError);
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
 * Compute average speed in km/h from step count and duration.
 * Uses the average cadence of 110 steps/min ≈ 5 km/h as the baseline.
 */
function stepsToSpeedKmh(steps: number, durationMs: number): number {
  const durationMin = durationMs / 60_000;
  if (durationMin <= 0) return 0;
  const stepsPerMin = steps / durationMin;
  // Linear interpolation from 0 steps/min → 0 km/h, using STEPS_PER_MINUTE_AT_5KMH ≈ BASELINE_SPEED_KMH
  return (stepsPerMin / STEPS_PER_MINUTE_AT_5KMH) * BASELINE_SPEED_KMH;
}

/**
 * Build a human-readable description for a Health Connect steps session.
 * Example (metric):   "Health Connect, 3,200 steps at 4.5 km/h."
 * Example (imperial): "Health Connect, 3,200 steps at 2.8 mph."
 */
function buildHCStepsNotes(steps: number, speedKmh: number): string {
  const stepsFormatted = steps.toLocaleString();
  const imperial = useImperialUnits();
  const speed = imperial ? kmhToMph(speedKmh).toFixed(1) : speedKmh.toFixed(1);
  const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');
  return t('session_notes_hc_steps', { steps: stepsFormatted, speed, speedUnit });
}

/**
 * Build a human-readable description for a Health Connect exercise session.
 * Example: "Health Connect, walking at 4.5 km/h."
 */
function buildHCExerciseNotes(exerciseName: string, durationMs: number, steps?: number): string {
  if (steps != null && steps > 0) {
    const speedKmh = stepsToSpeedKmh(steps, durationMs);
    return buildHCStepsNotes(steps, speedKmh);
  }
  return t('session_notes_hc_exercise', { exerciseName });
}

/**
 * Returns a localised name for an exercise type number.
 */
function exerciseTypeName(type: number): string {
  const keyMap: Record<number, string> = {
    2: 'exercise_badminton', 4: 'exercise_baseball', 5: 'exercise_basketball', 8: 'exercise_biking',
    14: 'exercise_cricket', 28: 'exercise_american_football', 29: 'exercise_australian_football',
    31: 'exercise_frisbee', 32: 'exercise_golf', 35: 'exercise_handball', 37: 'exercise_hiking',
    38: 'exercise_ice_hockey', 39: 'exercise_ice_skating', 46: 'exercise_paddling', 47: 'exercise_paragliding',
    51: 'exercise_rock_climbing', 52: 'exercise_roller_hockey', 53: 'exercise_rowing', 55: 'exercise_rugby',
    56: 'exercise_running', 58: 'exercise_sailing', 59: 'exercise_scuba_diving', 60: 'exercise_skating',
    61: 'exercise_skiing', 62: 'exercise_snowboarding', 63: 'exercise_snowshoeing', 64: 'exercise_soccer',
    65: 'exercise_softball', 72: 'exercise_surfing', 73: 'exercise_open_water_swimming', 76: 'exercise_tennis',
    78: 'exercise_volleyball', 79: 'exercise_walking', 80: 'exercise_water_polo', 82: 'exercise_wheelchair',
  };
  const key = keyMap[type];
  return key ? t(key) : t('exercise_unknown', { type });
}

/**
 * Returns true if every GPS cluster sample within [startMs, endMs] falls inside
 * a known indoor location — meaning the user was definitely not outside.
 * Returns false when there are no GPS samples for the period (cannot conclude).
 */
function wasDefinitelyAtKnownIndoorLocation(startMs: number, endMs: number): boolean {
  try {
    const parsed: unknown = JSON.parse(getSetting('location_clusters', '[]'));
    const allSamples: Array<{ lat: number; lon: number; timestamp: number }> =
      Array.isArray(parsed) ? parsed : [];
    const sessionSamples = allSamples.filter(
      s => s.timestamp >= startMs && s.timestamp <= endMs,
    );
    if (sessionSamples.length === 0) return false;

    const knownLocations = getKnownLocations();
    if (knownLocations.length === 0) return false;

    return sessionSamples.every(sample =>
      knownLocations.some(loc =>
        loc.isIndoor &&
        haversineDistanceMeters(sample.lat, sample.lon, loc.latitude, loc.longitude) <= loc.radiusMeters,
      ),
    );
  } catch (e) {
    console.warn('wasDefinitelyAtKnownIndoorLocation error:', e);
    return false;
  }
}

/** Prevents two concurrent syncs from processing the same HC records. */
let syncInProgress = false;

/**
 * Poll Health Connect for recent activity and submit any outside sessions found.
 * Called periodically by the background fetch task.
 */
export async function syncHealthConnect(): Promise<boolean> {
  if (syncInProgress) {
    return false;
  }
  // Respect the user's toggle: do not sync if the user has disabled Health Connect.
  if (getSetting('healthconnect_user_enabled', '0') !== '1') {
    return false;
  }
  syncInProgress = true;
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

      if (duration < MIN_DURATION_MS) {
        continue;
      }

      // Boost confidence for explicitly outdoor exercise types
      const isExplicitlyOutdoor = isOutdoorExerciseType(record.exerciseType);
      const confidence = isExplicitlyOutdoor ? 0.80 : CONFIDENCE_ACTIVITY;

      // Skip if GPS data shows the user was at a known indoor location throughout
      if (wasDefinitelyAtKnownIndoorLocation(start, end)) {
        continue;
      }

      const session = buildSession(
        start,
        end,
        'health_connect',
        confidence,
        buildHCExerciseNotes(exerciseTypeName(record.exerciseType), duration),
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

      for (const record of stepsResult.records) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        const recordedDuration = end - start;

        // Estimate duration from step count at average walking pace (5 km/h).
        // Health Connect sometimes batch-syncs steps with an inaccurately short
        // time window; the step-based estimate lets us recover those sessions.
        const estimatedDurationMs = (record.count / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
        const effectiveDurationMs = Math.max(recordedDuration, estimatedDurationMs);

        const sessionStart = end - effectiveDurationMs;

        // Skip if GPS data shows the user was at a known indoor location throughout
        if (wasDefinitelyAtKnownIndoorLocation(sessionStart, end)) {
          continue;
        }

        // Compute steps/min to determine confidence tier.
        // Records below 2.5 km/h are still submitted so they can merge with
        // adjacent records in the 5-minute window — the pruning phase removes
        // settled sessions that remain too slow after all merging is done.
        const stepsPerMinute = record.count / (effectiveDurationMs / 60_000);
        const isSlowWalking = stepsPerMinute < STEPS_PER_MIN_AT_4KMH;
        const stepConfidence = isSlowWalking ? CONFIDENCE_SLOW_WALK : CONFIDENCE_ACTIVITY;

        // Use the recorded end time (when batch-sync writes the record) and
        // extend backwards so the session covers the full estimated walk.
        // Step count is stored in the `steps` field, not in notes.
        const stepSpeedKmh = stepsToSpeedKmh(record.count, effectiveDurationMs);
        const session = buildSession(
          sessionStart,
          end,
          'health_connect',
          stepConfidence,
          buildHCStepsNotes(record.count, stepSpeedKmh),
          record.count,
          undefined,
          stepSpeedKmh > 0 ? stepSpeedKmh : undefined,
        );

        submitSession(session);
      }
    } catch (stepsError) {
      // Steps reading is supplementary — don't fail the whole sync if it errors
      if (!isPermissionError(stepsError)) {
        console.warn('Health Connect steps sync error:', stepsError);
      }
    }

    // Prune settled sessions from previous syncs that are too short or too slow.
    // A session is settled when its endTime is before (now - MIN_DURATION_MS):
    // no new records can merge into it. At that point remove it if:
    //   - it was discarded and is still under 5 minutes in duration, OR
    //   - its aggregated step rate is below the minimum walking speed (2.5 km/h).
    const pruneBeforeMs = now - MIN_DURATION_MS;
    pruneShortDiscardedHealthConnectSessions(pruneBeforeMs, STEPS_PER_MIN_AT_2_5KMH);

    // Update last sync timestamp
    setSetting('healthconnect_last_sync', String(now));
    // Notify UI screens so they can refresh without requiring navigation.
    emitSessionsChanged();
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
  } finally {
    syncInProgress = false;
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
