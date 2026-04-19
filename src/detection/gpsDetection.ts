import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import {
  getKnownLocationsAsync,
  getAllKnownLocationsAsync,
  upsertKnownLocationAsync,
  getSettingAsync,
  setSettingAsync,
  KnownLocation,
  initDatabaseAsync,
  insertBackgroundLogAsync,
} from '../storage';
import { submitSession, buildSession } from './sessionMerger';
import { t } from '../i18n';
import { isImperialUnits, kmToMiles, kmhToMph } from '../utils/units';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';

const LOCATION_TRACK_TASK = 'TOUCHGRASS_LOCATION_TRACK';

const CONFIDENCE_GPS_ONLY = 0.8;
export const MIN_OUTSIDE_DURATION_MS = 5 * 60 * 1000;

// How many times the geofence radius to search for the departure/arrival location.
// Using 2× the stored radius covers cases where the user was just outside the
// geofence boundary when they began tracking but clearly departed from that location.
const DEPARTURE_LOCATION_RADIUS_MULTIPLIER = 2;

/** Minimum configurable geofence radius in metres. */
export const MIN_RADIUS_METERS = 25;
/** Maximum configurable geofence radius in metres. */
export const MAX_RADIUS_METERS = 250;

/**
 * Clamp an arbitrary radius value into the supported [MIN_RADIUS_METERS, MAX_RADIUS_METERS] range.
 * Used for migration of existing locations that were saved with an out-of-range radius.
 */
export function clampRadiusMeters(r: number): number {
  return Math.max(MIN_RADIUS_METERS, Math.min(MAX_RADIUS_METERS, r));
}

// ── Dynamic tracking profiles ─────────────────────────────
//
// LOW profile (default): network-only positioning, scaled distanceInterval.
//   No GPS acquisition jobs → no JobScheduler "considered buggy" warning.
// HIGH burst profile: Balanced accuracy (network+GPS) for a short window when
//   the user is near a small-radius geofence boundary and a precise fix matters.
//   Bounded by BURST_DURATION_MS and cooled by BURST_COOLDOWN_MS to keep
//   GPS-job frequency low enough that Android doesn't flag us again.

/** Accuracy used during the default LOW tracking profile. */
export const PROFILE_LOW_ACCURACY = Location.Accuracy.Lowest;
/** Accuracy used during a HIGH burst. */
export const PROFILE_HIGH_ACCURACY = Location.Accuracy.Balanced;

/** How long a HIGH burst lasts before reverting to LOW (ms). */
export const BURST_DURATION_MS = 60_000; // 60 seconds
/** Minimum gap between two consecutive HIGH bursts (ms). */
export const BURST_COOLDOWN_MS = 10 * 60_000; // 10 minutes

/**
 * Radius threshold below which a geofence is considered "small" and therefore
 * eligible for a burst when the user is near the boundary.
 */
const BURST_RADIUS_THRESHOLD_M = 75;
/**
 * A burst is triggered when the user is within this fraction of the geofence
 * radius from the boundary (or at least MIN_BOUNDARY_MARGIN_M, whichever is
 * larger).
 */
const BURST_BOUNDARY_FRACTION = 0.25;
const MIN_BOUNDARY_MARGIN_M = 20;

// In-memory burst state (also persisted to SQLite so it survives restarts)
type TrackingProfile = 'low' | 'high';
let currentProfile: TrackingProfile = 'low';
let burstUntilTimestamp = 0;
let lastBurstAtTimestamp = 0;

// Persistence keys for burst state
const GPS_PROFILE_KEY = 'gps_tracking_profile';
const GPS_BURST_UNTIL_KEY = 'gps_burst_until';
const GPS_LAST_BURST_KEY = 'gps_last_burst';

/**
 * Persisted GPS session state, stored in and restored from SQLite.
 */
export interface GpsState {
  outsideSessionStart: number | null;
  lastKnownOutside: boolean;
}

// In-memory state for the current outside session
let outsideSessionStart: number | null = null;
let lastKnownOutside = false;
let gpsSessionDistanceMeters = 0;
let gpsSessionSpeedSum = 0;
let gpsSessionSpeedCount = 0;
let gpsSessionStartLocationLabel: string | null = null;
let gpsSessionLastLat: number | null = null;
let gpsSessionLastLon: number | null = null;
// Suppress duplicate indoor-location log entries. States:
//   undefined = never logged (initial state)
//   null      = last update was outdoors
//   string    = label of the last logged indoor location
let lastLoggedIndoorLocation: string | null | undefined = undefined;

// Persistence keys for GPS session state
const GPS_SESSION_START_KEY = 'gps_session_start';
const GPS_LAST_OUTSIDE_KEY = 'gps_last_outside';

/**
 * Load GPS session state from persistent storage.
 * Must be called at the start of every background task invocation to ensure
 * in-memory state reflects the latest values written to SQLite.
 */
export async function loadGPSState(): Promise<void> {
  const [startRaw, outsideRaw, profileRaw, burstUntilRaw, lastBurstRaw] = await Promise.all([
    getSettingAsync(GPS_SESSION_START_KEY, '0'),
    getSettingAsync(GPS_LAST_OUTSIDE_KEY, '0'),
    getSettingAsync(GPS_PROFILE_KEY, 'low'),
    getSettingAsync(GPS_BURST_UNTIL_KEY, '0'),
    getSettingAsync(GPS_LAST_BURST_KEY, '0'),
  ]);
  const start = parseInt(startRaw, 10);
  outsideSessionStart = start > 0 ? start : null;
  lastKnownOutside = outsideRaw === '1';
  currentProfile = profileRaw as TrackingProfile;
  burstUntilTimestamp = parseInt(burstUntilRaw, 10);
  lastBurstAtTimestamp = parseInt(lastBurstRaw, 10);
}

/**
 * Persist GPS session state so it survives app restarts.
 */
async function saveGPSState(): Promise<void> {
  await Promise.all([
    setSettingAsync(GPS_SESSION_START_KEY, String(outsideSessionStart ?? 0)),
    setSettingAsync(GPS_LAST_OUTSIDE_KEY, lastKnownOutside ? '1' : '0'),
    setSettingAsync(GPS_PROFILE_KEY, currentProfile),
    setSettingAsync(GPS_BURST_UNTIL_KEY, String(burstUntilTimestamp)),
    setSettingAsync(GPS_LAST_BURST_KEY, String(lastBurstAtTimestamp)),
  ]);
}

/**
 * Reset all in-memory GPS session state.
 * Exported for use in unit tests only.
 * @internal
 */
export function _resetGPSStateForTesting(): void {
  outsideSessionStart = null;
  lastKnownOutside = false;
  gpsSessionDistanceMeters = 0;
  gpsSessionSpeedSum = 0;
  gpsSessionSpeedCount = 0;
  gpsSessionStartLocationLabel = null;
  gpsSessionLastLat = null;
  gpsSessionLastLon = null;
  currentProfile = 'low';
  burstUntilTimestamp = 0;
  lastBurstAtTimestamp = 0;
}

/**
 * Request location permissions (foreground + background).
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

/**
 * Compute the minimum active geofence radius across all active known locations.
 * Returns a clamped value in [MIN_RADIUS_METERS, MAX_RADIUS_METERS].
 * Falls back to MAX_RADIUS_METERS when no active locations exist.
 */
export function computeMinActiveRadius(locations: KnownLocation[]): number {
  const activeIndoor = locations.filter((l) => l.isIndoor);
  if (activeIndoor.length === 0) return MAX_RADIUS_METERS;
  const minR = Math.min(...activeIndoor.map((l) => l.radiusMeters));
  return Math.max(MIN_RADIUS_METERS, Math.min(MAX_RADIUS_METERS, minR));
}

/**
 * Compute the distanceInterval (in metres) for the LOW tracking profile based
 * on the smallest active geofence radius.
 *
 * Heuristic: distanceIntervalLow = clamp(minRadius * 0.5, 25, 125)
 */
export function computeLowDistanceInterval(minRadiusMeters: number): number {
  return Math.max(25, Math.min(125, Math.round(minRadiusMeters * 0.5)));
}

/**
 * Compute the distanceInterval (in metres) for the HIGH burst profile based
 * on the smallest active geofence radius.
 *
 * Heuristic: distanceIntervalHigh = clamp(minRadius * 0.2, 10, 50)
 */
export function computeHighDistanceInterval(minRadiusMeters: number): number {
  return Math.max(10, Math.min(50, Math.round(minRadiusMeters * 0.2)));
}

/**
 * Build the expo-location options for the given profile and minimum radius.
 * Exported for unit testing.
 */
export function buildLocationOptions(
  profile: 'low' | 'high',
  minRadiusMeters: number
): NonNullable<Parameters<typeof Location.startLocationUpdatesAsync>[1]> {
  const foregroundService = {
    notificationTitle: 'TouchGrass',
    notificationBody: t('gps_tracking_notif_body'),
    notificationColor: '#4A7C59',
  };

  if (profile === 'high') {
    return {
      // Balanced (network+GPS) for a short burst when near a small-radius boundary.
      // Prefer Balanced over High to reduce GPS-job frequency.
      accuracy: PROFILE_HIGH_ACCURACY,
      timeInterval: 15_000, // 15 seconds during burst
      distanceInterval: computeHighDistanceInterval(minRadiusMeters),
      showsBackgroundLocationIndicator: false,
      foregroundService,
      pausesUpdatesAutomatically: false,
    };
  }

  return {
    // Use Lowest accuracy (PRIORITY_LOW_POWER / network-only) instead of Balanced
    // (PRIORITY_BALANCED_POWER_ACCURACY / GPS+network).
    //
    // When the app is on Android's battery-optimization whitelist
    // (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS), the Fused Location Provider
    // schedules GPS-acquisition jobs via JobScheduler on behalf of the app.
    // GPS fixes frequently fail indoors, causing repeated job rescheduling.
    // Android detects this pattern and logs:
    //   W/JobScheduler.JobStatus: Exempted app … considered buggy
    //   From com.android.location.fused
    //
    // Switching to network-only positioning eliminates GPS acquisition jobs.
    // Network location (Wi-Fi + cell) resolves immediately, so no jobs are
    // rescheduled, and the warning disappears. Accuracy is still sufficient
    // for home/work geofencing (~10-100 m with Wi-Fi, ~100-500 m on cell).
    accuracy: PROFILE_LOW_ACCURACY,
    timeInterval: 5 * 60 * 1000, // every 5 minutes
    distanceInterval: computeLowDistanceInterval(minRadiusMeters),
    showsBackgroundLocationIndicator: false,
    foregroundService,
    pausesUpdatesAutomatically: false,
  };
}

/**
 * Start background location tracking for geofencing.
 * Only starts if permissions are already granted.
 *
 * @param profile  'low' (default) or 'high' burst — determines accuracy and intervals.
 * @param minRadiusMeters  Smallest active geofence radius, used to scale distanceInterval.
 */
export async function startLocationTracking(
  profile: 'low' | 'high' = 'low',
  minRadiusMeters: number = MAX_RADIUS_METERS
): Promise<void> {
  // Check if we already have permissions
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  const { status: bg } = await Location.getBackgroundPermissionsAsync();

  if (fg !== 'granted' || bg !== 'granted') {
    console.log('TouchGrass: GPS tracking not started - permissions not granted');
    return;
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
  if (isTracking) {
    console.log('TouchGrass: GPS tracking already running');
    return;
  }

  console.log(
    `TouchGrass: Starting GPS tracking (profile=${profile}, minRadius=${minRadiusMeters}m)`
  );
  currentProfile = profile;
  await Location.startLocationUpdatesAsync(
    LOCATION_TRACK_TASK,
    buildLocationOptions(profile, minRadiusMeters)
  );
  console.log('TouchGrass: GPS tracking started successfully');
}

/**
 * Switch tracking to a different profile without stopping the foreground service.
 * Stops the current task and immediately restarts with the new options.
 * Safe to call from the background task callback.
 */
export async function switchLocationProfile(
  profile: 'low' | 'high',
  minRadiusMeters: number
): Promise<void> {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACK_TASK);
  }
  currentProfile = profile;
  const opts = buildLocationOptions(profile, minRadiusMeters);
  await Location.startLocationUpdatesAsync(LOCATION_TRACK_TASK, opts);
  console.log(
    `TouchGrass: Switched to ${profile} profile (distanceInterval=${opts.distanceInterval}m)`
  );
}

/**
 * Stop background location tracking.
 */
export async function stopLocationTracking(): Promise<void> {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACK_TASK);
  }
}

/**
 * Check if a coordinate is inside any known indoor location.
 */
export function isAtKnownIndoorLocation(
  lat: number,
  lon: number,
  locations: KnownLocation[]
): boolean {
  return locations.some((loc) => {
    if (!loc.isIndoor) return false;
    const dist = haversineDistance(lat, lon, loc.latitude, loc.longitude);
    return dist <= loc.radiusMeters;
  });
}

/**
 * Build a human-readable description for a GPS session.
 * Example (metric):   "GPS detection, left Home and returned for 2.3 km at 4.5 km/h."
 * Example (imperial): "GPS detection, left Home and returned for 1.4 mi at 2.8 mph."
 */
function buildGpsNotes(
  startLocationLabel: string | null,
  endLocationLabel: string | null,
  distanceMeters: number,
  averageSpeedKmh: number
): string {
  const imperial = isImperialUnits();
  const distKm = distanceMeters / 1000;
  const dist = imperial ? kmToMiles(distKm).toFixed(1) : distKm.toFixed(1);
  const distUnit = imperial ? 'mi' : 'km';
  const speed = imperial ? kmhToMph(averageSpeedKmh).toFixed(1) : averageSpeedKmh.toFixed(1);
  const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');

  if (startLocationLabel && endLocationLabel) {
    if (startLocationLabel === endLocationLabel) {
      return t('session_notes_gps_left_returned', {
        start: startLocationLabel,
        dist,
        distUnit,
        speed,
        speedUnit,
      });
    }
    return t('session_notes_gps_left_went', {
      start: startLocationLabel,
      end: endLocationLabel,
      dist,
      distUnit,
      speed,
      speedUnit,
    });
  }
  if (startLocationLabel) {
    return t('session_notes_gps_left', {
      start: startLocationLabel,
      dist,
      distUnit,
      speed,
      speedUnit,
    });
  }
  if (endLocationLabel) {
    return t('session_notes_gps_returned', {
      end: endLocationLabel,
      dist,
      distUnit,
      speed,
      speedUnit,
    });
  }
  return t('session_notes_gps_no_location', { dist, distUnit, speed, speedUnit });
}

/**
 * Decide whether a HIGH accuracy burst should be triggered for the current
 * position, given the configured geofences and current time.
 *
 * A burst is triggered when ALL of the following are true:
 *  1. There is at least one "small" active indoor geofence (radius ≤ BURST_RADIUS_THRESHOLD_M).
 *  2. The user is within `max(MIN_BOUNDARY_MARGIN_M, R * BURST_BOUNDARY_FRACTION)` of the
 *     boundary of that geofence (i.e. `abs(distance(user, center) - R) <= margin`).
 *  3. The burst cooldown has passed (now - lastBurstAtTimestamp >= BURST_COOLDOWN_MS).
 *  4. We are currently in the LOW profile (no burst already active).
 *
 * @param lat        Current latitude.
 * @param lon        Current longitude.
 * @param locations  Active known locations to check.
 * @param now        Current epoch timestamp (ms).
 * @param locationAccuracy  Reported accuracy of the current fix (metres), optional.
 */
export function shouldTriggerBurst(
  lat: number,
  lon: number,
  locations: KnownLocation[],
  now: number,
  locationAccuracy?: number
): boolean {
  if (currentProfile === 'high') return false; // burst already active
  if (now - lastBurstAtTimestamp < BURST_COOLDOWN_MS) return false;

  for (const loc of locations) {
    if (!loc.isIndoor) continue;
    if (loc.radiusMeters > BURST_RADIUS_THRESHOLD_M) continue;

    const d = haversineDistance(lat, lon, loc.latitude, loc.longitude);
    const boundaryDelta = Math.abs(d - loc.radiusMeters);
    const margin = Math.max(MIN_BOUNDARY_MARGIN_M, loc.radiusMeters * BURST_BOUNDARY_FRACTION);

    const nearBoundary = boundaryDelta <= margin;
    // Also trigger when the reported fix accuracy is worse than the radius, meaning
    // the device can't distinguish inside-from-outside from the fix alone. We cap the
    // accuracy check at BURST_ACCURACY_CAP_M (150 m) to avoid triggering on low-quality
    // cell-tower fixes in areas where all geofences are small — a 500 m accuracy reading
    // with a 50 m geofence is just a bad fix, not a useful signal.
    const BURST_ACCURACY_CAP_M = 150;
    const ambiguousAccuracy =
      locationAccuracy !== undefined &&
      locationAccuracy >= Math.min(BURST_ACCURACY_CAP_M, loc.radiusMeters);
    const inAmbiguousZone = d <= loc.radiusMeters + margin && d >= loc.radiusMeters - margin;

    if (nearBoundary || (ambiguousAccuracy && inAmbiguousZone)) {
      return true;
    }
  }
  return false;
}

/**
 * Process a new location update.
 * Called by the background task.
 */
export async function processLocationUpdate(
  lat: number,
  lon: number,
  timestamp: number,
  speedMs?: number
): Promise<void> {
  const knownLocations = await getKnownLocationsAsync();
  const isIndoor = isAtKnownIndoorLocation(lat, lon, knownLocations);
  const isOutside = !isIndoor;

  // Accumulate distance between consecutive GPS points during an outdoor session.
  if (lastKnownOutside && gpsSessionLastLat !== null && gpsSessionLastLon !== null) {
    const segDist = haversineDistance(gpsSessionLastLat, gpsSessionLastLon, lat, lon);
    gpsSessionDistanceMeters += segDist;
  }

  // Record speed sample (m/s → km/h) when valid.
  if (speedMs != null && speedMs >= 0) {
    gpsSessionSpeedSum += speedMs * 3.6;
    gpsSessionSpeedCount++;
  }

  // Keep track of last position for distance calculation.
  gpsSessionLastLat = lat;
  gpsSessionLastLon = lon;

  if (isOutside && !lastKnownOutside) {
    // Just went outside — record the departure location label if available.
    const departureLocation = knownLocations.find(
      (loc) =>
        loc.isIndoor &&
        haversineDistance(lat, lon, loc.latitude, loc.longitude) <=
          loc.radiusMeters * DEPARTURE_LOCATION_RADIUS_MULTIPLIER
    );
    gpsSessionStartLocationLabel = departureLocation?.label ?? null;
    outsideSessionStart = timestamp;
    lastKnownOutside = true;
    gpsSessionDistanceMeters = 0;
    gpsSessionSpeedSum = 0;
    gpsSessionSpeedCount = 0;
    console.log('TouchGrass: GPS update - now outside, session started');
    await insertBackgroundLogAsync(
      'gps',
      gpsSessionStartLocationLabel
        ? `Left ${gpsSessionStartLocationLabel} — outside`
        : 'Outside (no known location)'
    );
  } else if (!isOutside && lastKnownOutside && outsideSessionStart !== null) {
    // Just came back inside
    const duration = timestamp - outsideSessionStart;
    const matchedLocation = knownLocations.find(
      (loc) =>
        // Recompute the matched location solely for the debug log label.
        loc.isIndoor && haversineDistance(lat, lon, loc.latitude, loc.longitude) <= loc.radiusMeters
    );
    const locationLabel = matchedLocation?.label || `(${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    console.log(
      `TouchGrass: GPS update - at known location "${locationLabel}", ended outside session of ${Math.round(duration / 60000)} min`
    );
    if (duration >= MIN_OUTSIDE_DURATION_MS) {
      const avgSpeed = gpsSessionSpeedCount > 0 ? gpsSessionSpeedSum / gpsSessionSpeedCount : 0;
      const notes = buildGpsNotes(
        gpsSessionStartLocationLabel,
        matchedLocation?.label ?? null,
        gpsSessionDistanceMeters,
        avgSpeed
      );
      const session = buildSession(
        outsideSessionStart,
        timestamp,
        'gps',
        CONFIDENCE_GPS_ONLY,
        notes,
        undefined,
        gpsSessionDistanceMeters > 0 ? gpsSessionDistanceMeters : undefined,
        gpsSessionSpeedCount > 0 ? gpsSessionSpeedSum / gpsSessionSpeedCount : undefined
      );
      await submitSession(session);
      emitSessionsChanged();
      await insertBackgroundLogAsync(
        'gps',
        `Back inside at ${locationLabel} — recorded ${Math.round(duration / 60000)} min session`
      );
    } else {
      await insertBackgroundLogAsync(
        'gps',
        `Back inside at ${locationLabel} — too short (${Math.round(duration / 60000)} min), not recorded`
      );
    }
    outsideSessionStart = null;
    lastKnownOutside = false;
    gpsSessionDistanceMeters = 0;
    gpsSessionSpeedSum = 0;
    gpsSessionSpeedCount = 0;
    gpsSessionStartLocationLabel = null;
  } else if (isOutside && lastKnownOutside && outsideSessionStart !== null) {
    // Still outside without an indoor transition.
    // Flush periodically so sessions are logged even when no known indoor
    // locations exist to trigger the normal transition-based completion.
    const duration = timestamp - outsideSessionStart;
    console.log(
      `TouchGrass: GPS update - still outside, current session length: ${Math.round(duration / 60000)} min`
    );
    await insertBackgroundLogAsync(
      'gps',
      `Still outside — ${Math.round(duration / 60000)} min so far`
    );
    if (duration >= MIN_OUTSIDE_DURATION_MS) {
      const avgSpeed = gpsSessionSpeedCount > 0 ? gpsSessionSpeedSum / gpsSessionSpeedCount : 0;
      const notes = buildGpsNotes(
        gpsSessionStartLocationLabel,
        null,
        gpsSessionDistanceMeters,
        avgSpeed
      );
      const session = buildSession(
        outsideSessionStart,
        timestamp,
        'gps',
        CONFIDENCE_GPS_ONLY,
        notes,
        undefined,
        gpsSessionDistanceMeters > 0 ? gpsSessionDistanceMeters : undefined,
        gpsSessionSpeedCount > 0 ? gpsSessionSpeedSum / gpsSessionSpeedCount : undefined
      );
      await submitSession(session);
      emitSessionsChanged();
      outsideSessionStart = timestamp; // start next segment from now
      gpsSessionDistanceMeters = 0;
      gpsSessionSpeedSum = 0;
      gpsSessionSpeedCount = 0;
    }
  }

  await saveGPSState();

  // Log "inside at known location" only when the matched location changes from the last
  // logged one. This prevents flooding the log on every GPS update during indoor periods.
  if (!isOutside && !lastKnownOutside) {
    const matchedLocation = knownLocations.find(
      (loc) =>
        loc.isIndoor && haversineDistance(lat, lon, loc.latitude, loc.longitude) <= loc.radiusMeters
    );
    const label = matchedLocation?.label ?? null;
    if (label !== null && label !== lastLoggedIndoorLocation) {
      await insertBackgroundLogAsync('gps', `Inside at ${label}`);
      lastLoggedIndoorLocation = label;
    }
  } else if (isOutside) {
    lastLoggedIndoorLocation = null;
  }

  // Update location clusters for auto-detect
  await recordLocationForClustering(lat, lon, timestamp);
}

/**
 * Auto-detect frequently-visited locations from GPS dwell time.
 * Suggests a location after the user spends:
 *   - 2 hours at the same place when no known locations exist yet
 *   - 3 hours at the same place when known locations already exist
 * Only runs when GPS is permitted and location suggestions are enabled.
 */
export async function autoDetectLocations(): Promise<void> {
  // Guard: only run when GPS is permitted
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  // Guard: only run when suggestions are enabled
  if ((await getSettingAsync('location_suggestions_enabled', '1')) !== '1') return;

  try {
    const rawClusters = await getSettingAsync('location_clusters', '[]');
    const samples: LocationSample[] = JSON.parse(rawClusters);

    if (samples.length < 10) return; // not enough data yet

    const dwellClusters = computeDwellClusters(samples);

    // Threshold depends on whether active known locations already exist
    const existingActive = await getKnownLocationsAsync();
    const thresholdMs =
      existingActive.length === 0
        ? 2 * 60 * 60 * 1000 // 2 hours when no known locations
        : 3 * 60 * 60 * 1000; // 3 hours when known locations exist

    const allLocations = await getAllKnownLocationsAsync();

    // Hoist setting read out of the loop — value doesn't change during a single run.
    const suggestionRadius = parseInt(
      await getSettingAsync('location_suggestion_radius', String(CLUSTER_DETECTION_RADIUS_M)),
      10
    );

    for (const cluster of dwellClusters) {
      if (cluster.totalDwellMs < thresholdMs) continue;

      // Skip if this place is already known (active or suggested)
      const alreadyKnown = allLocations.some(
        (loc) =>
          haversineDistance(loc.latitude, loc.longitude, cluster.lat, cluster.lon) <=
          loc.radiusMeters
      );
      if (alreadyKnown) continue;

      // Insert as a suggested location with an empty label (displayed as default at render time)
      // Use the user's chosen default suggestion radius (falls back to CLUSTER_DETECTION_RADIUS_M)
      await upsertKnownLocationAsync({
        label: '',
        latitude: cluster.lat,
        longitude: cluster.lon,
        radiusMeters: isNaN(suggestionRadius) ? CLUSTER_DETECTION_RADIUS_M : suggestionRadius,
        isIndoor: true,
        status: 'suggested',
      });

      // Notify the user about the new suggestion
      await sendLocationSuggestionNotification();

      // Only suggest one new location per run to avoid flooding
      break;
    }
  } catch (e) {
    console.warn('Auto-detect locations error:', e);
  }
}

/**
 * Send a local notification to inform the user that a new location has been suggested.
 */
async function sendLocationSuggestionNotification(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_location_suggestion_title'),
        body: t('notif_location_suggestion_body'),
        // Note: 'data' is intentionally omitted. Passing a 'data' object causes
        // NotificationContent.mBody to be a JSONObject. On Android, R8/ProGuard can
        // strip the private writeObject() method despite the keep rule, falling back to
        // default Java serialization which cannot serialize JSONObject → NotSerializableException.
        color: '#4A7C59',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: 'touchgrass_reminders',
      },
    });
  } catch (e) {
    console.warn('Failed to send location suggestion notification:', e);
  }
}

// ── Location clustering helpers ───────────────────────────

interface LocationSample {
  lat: number;
  lon: number;
  timestamp: number;
}

interface DwellCluster {
  lat: number;
  lon: number;
  latSum: number;
  lonSum: number;
  totalDwellMs: number;
  sampleCount: number;
}

const MAX_CLUSTER_SAMPLES = 500;
// Maximum gap between two consecutive samples to count as continuous dwell
const MAX_DWELL_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours
/**
 * Radius (metres) used when deciding if two GPS points are "at the same place"
 * for dwell-time clustering. This is a data-collection constant independent of
 * any individual location's geofence radius.
 */
export const CLUSTER_DETECTION_RADIUS_M = 100;

async function recordLocationForClustering(
  lat: number,
  lon: number,
  timestamp: number
): Promise<void> {
  try {
    const raw = await getSettingAsync('location_clusters', '[]');
    const clusters: LocationSample[] = JSON.parse(raw);
    clusters.push({ lat, lon, timestamp });
    // Keep only the most recent samples
    const trimmed = clusters.slice(-MAX_CLUSTER_SAMPLES);
    await setSettingAsync('location_clusters', JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Clustering error:', e);
  }
}

/**
 * Compute dwell time at distinct locations from a list of GPS samples.
 * Consecutive samples within 100 m of each other (with no gap > MAX_DWELL_GAP_MS)
 * are merged into a cluster and their inter-sample intervals summed as dwell time.
 * Exported for unit testing.
 */
export function computeDwellClusters(samples: LocationSample[]): DwellCluster[] {
  if (samples.length < 2) return [];

  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const clusters: DwellCluster[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const dist = haversineDistance(curr.lat, curr.lon, next.lat, next.lon);
    const gap = next.timestamp - curr.timestamp;

    // Only accumulate dwell if the user stayed nearby with no large gap
    if (dist <= CLUSTER_DETECTION_RADIUS_M && gap <= MAX_DWELL_GAP_MS) {
      let found = false;
      for (const c of clusters) {
        if (haversineDistance(c.lat, c.lon, curr.lat, curr.lon) <= CLUSTER_DETECTION_RADIUS_M) {
          c.totalDwellMs += gap;
          c.sampleCount++;
          c.latSum += curr.lat;
          c.lonSum += curr.lon;
          c.lat = c.latSum / c.sampleCount;
          c.lon = c.lonSum / c.sampleCount;
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({
          lat: curr.lat,
          lon: curr.lon,
          latSum: curr.lat,
          lonSum: curr.lon,
          totalDwellMs: gap,
          sampleCount: 1,
        });
      }
    }
  }

  return clusters;
}

// ── Haversine distance ────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Background task definition ────────────────────────────
// This must be defined at module level (outside any component)

TaskManager.defineTask(
  LOCATION_TRACK_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.warn('Location task error:', error);
      return;
    }
    // Ensure the DB schema and migrations are applied before any DB access.
    // The background JS runtime does not guarantee App.tsx has run first.
    await initDatabaseAsync();
    // Always read persisted GPS state from SQLite at every task invocation so
    // that in-memory state never lags behind what was last written to the DB.
    await loadGPSState();
    // Respect the user's toggle: if GPS was disabled while the OS task was
    // still alive, skip processing and do not submit any session.
    if ((await getSettingAsync('gps_user_enabled', '0')) !== '1') {
      console.log('TouchGrass: GPS task fired but GPS is disabled by user — skipping');
      return;
    }
    if (data?.locations?.length > 0) {
      const loc = data.locations[data.locations.length - 1];
      const now = loc.timestamp;
      await processLocationUpdate(
        loc.coords.latitude,
        loc.coords.longitude,
        now,
        loc.coords.speed ?? undefined
      );

      // ── Dynamic profile management ────────────────────────
      const activeLocations = await getKnownLocationsAsync();
      const minRadius = computeMinActiveRadius(activeLocations);

      // Check whether a running HIGH burst has expired and should revert to LOW.
      if (currentProfile === 'high' && now >= burstUntilTimestamp) {
        await insertBackgroundLogAsync('gps', 'Burst expired — reverting to LOW profile');
        burstUntilTimestamp = 0;
        await saveGPSState();
        try {
          await switchLocationProfile('low', minRadius);
        } catch (e) {
          console.warn('TouchGrass: Failed to switch back to LOW profile', e);
        }
      } else if (
        currentProfile === 'low' &&
        shouldTriggerBurst(
          loc.coords.latitude,
          loc.coords.longitude,
          activeLocations,
          now,
          loc.coords.accuracy ?? undefined
        )
      ) {
        // Trigger a HIGH burst.
        lastBurstAtTimestamp = now;
        burstUntilTimestamp = now + BURST_DURATION_MS;
        await insertBackgroundLogAsync('gps', `Burst triggered (minRadius=${minRadius}m)`);
        await saveGPSState();
        try {
          await switchLocationProfile('high', minRadius);
        } catch (e) {
          console.warn('TouchGrass: Failed to switch to HIGH burst profile', e);
        }
      }

      // Run dwell-based location suggestion after processing
      await autoDetectLocations();
    }
  }
);
