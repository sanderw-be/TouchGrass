import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import {
  getKnownLocations,
  getAllKnownLocations,
  upsertKnownLocation,
  getSetting,
  setSetting,
  KnownLocation,
  initDatabase,
} from '../storage/database';
import { submitSession, buildSession } from './sessionMerger';
import { t } from '../i18n';
import { isImperialUnits, kmToMiles, kmhToMph } from '../utils/units';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';

const GEOFENCE_TASK = 'TOUCHGRASS_GEOFENCE';
const LOCATION_TRACK_TASK = 'TOUCHGRASS_LOCATION_TRACK';

const CONFIDENCE_GPS_ONLY = 0.8;
const CONFIDENCE_GPS_AND_ACTIVITY = 0.95;
export const MIN_OUTSIDE_DURATION_MS = 5 * 60 * 1000;

// How many times the geofence radius to search for the departure/arrival location.
// Using 2× the stored radius covers cases where the user was just outside the
// geofence boundary when they began tracking but clearly departed from that location.
const DEPARTURE_LOCATION_RADIUS_MULTIPLIER = 2;

// In-memory state for the current outside session
let outsideSessionStart: number | null = null;
let lastKnownOutside = false;
let gpsStateLoaded = false;
let gpsSessionDistanceMeters = 0;
let gpsSessionSpeedSum = 0;
let gpsSessionSpeedCount = 0;
let gpsSessionStartLocationLabel: string | null = null;
let gpsSessionLastLat: number | null = null;
let gpsSessionLastLon: number | null = null;

// Persistence keys for GPS session state
const GPS_SESSION_START_KEY = 'gps_session_start';
const GPS_LAST_OUTSIDE_KEY = 'gps_last_outside';

/**
 * Load GPS session state from persistent storage.
 * Called lazily on the first location update after a (re)start.
 */
function loadGPSState(): void {
  if (gpsStateLoaded) return;
  const start = parseInt(getSetting(GPS_SESSION_START_KEY, '0'), 10);
  const outside = getSetting(GPS_LAST_OUTSIDE_KEY, '0') === '1';
  outsideSessionStart = start > 0 ? start : null;
  lastKnownOutside = outside;
  gpsStateLoaded = true;
}

/**
 * Persist GPS session state so it survives app restarts.
 */
function saveGPSState(): void {
  setSetting(GPS_SESSION_START_KEY, String(outsideSessionStart ?? 0));
  setSetting(GPS_LAST_OUTSIDE_KEY, lastKnownOutside ? '1' : '0');
}

/**
 * Reset all in-memory GPS session state.
 * Exported for use in unit tests only.
 * @internal
 */
export function _resetGPSStateForTesting(): void {
  outsideSessionStart = null;
  lastKnownOutside = false;
  gpsStateLoaded = false;
  gpsSessionDistanceMeters = 0;
  gpsSessionSpeedSum = 0;
  gpsSessionSpeedCount = 0;
  gpsSessionStartLocationLabel = null;
  gpsSessionLastLat = null;
  gpsSessionLastLon = null;
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
 * Start background location tracking for geofencing.
 * Only starts if permissions are already granted.
 */
export async function startLocationTracking(): Promise<void> {
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

  console.log('TouchGrass: Starting GPS tracking with background notification');
  await Location.startLocationUpdatesAsync(LOCATION_TRACK_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000, // every 5 minutes
    distanceInterval: 100, // or every 100 meters
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'TouchGrass',
      notificationBody: 'Tracking outside time in the background',
      notificationColor: '#4A7C59',
    },
    pausesUpdatesAutomatically: false,
  });
  console.log('TouchGrass: GPS tracking started successfully');
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
 * Process a new location update.
 * Called by the background task.
 */
export function processLocationUpdate(
  lat: number,
  lon: number,
  timestamp: number,
  speedMs?: number
): void {
  loadGPSState();

  const knownLocations = getKnownLocations();
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
      submitSession(session);
      emitSessionsChanged();
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
      submitSession(session);
      emitSessionsChanged();
      outsideSessionStart = timestamp; // start next segment from now
      gpsSessionDistanceMeters = 0;
      gpsSessionSpeedSum = 0;
      gpsSessionSpeedCount = 0;
    }
  }

  saveGPSState();

  // Update location clusters for auto-detect
  recordLocationForClustering(lat, lon, timestamp);
}

/**
 * Auto-detect frequently-visited locations from GPS dwell time.
 * Suggests a location after the user spends:
 *   - 2 hours at the same place when no known locations exist yet
 *   - 10 hours at the same place when known locations already exist
 * Only runs when GPS is permitted and location suggestions are enabled.
 */
export async function autoDetectLocations(): Promise<void> {
  // Guard: only run when GPS is permitted
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  // Guard: only run when suggestions are enabled
  if (getSetting('location_suggestions_enabled', '1') !== '1') return;

  try {
    const rawClusters = getSetting('location_clusters', '[]');
    const samples: LocationSample[] = JSON.parse(rawClusters);

    if (samples.length < 10) return; // not enough data yet

    const dwellClusters = computeDwellClusters(samples);

    // Threshold depends on whether active known locations already exist
    const existingActive = getKnownLocations();
    const thresholdMs =
      existingActive.length === 0
        ? 2 * 60 * 60 * 1000 // 2 hours when no known locations
        : 10 * 60 * 60 * 1000; // 10 hours when known locations exist

    const allLocations = getAllKnownLocations();

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
      const suggestionRadius = parseInt(
        getSetting('location_suggestion_radius', String(CLUSTER_DETECTION_RADIUS_M)),
        10
      );
      upsertKnownLocation({
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

function recordLocationForClustering(lat: number, lon: number, timestamp: number): void {
  try {
    const raw = getSetting('location_clusters', '[]');
    const clusters: LocationSample[] = JSON.parse(raw);
    clusters.push({ lat, lon, timestamp });
    // Keep only the most recent samples
    const trimmed = clusters.slice(-MAX_CLUSTER_SAMPLES);
    setSetting('location_clusters', JSON.stringify(trimmed));
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

TaskManager.defineTask(LOCATION_TRACK_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('Location task error:', error);
    return;
  }
  // Ensure the DB schema and migrations are applied before any DB access.
  // The background JS runtime does not guarantee App.tsx has run first.
  initDatabase();
  // Respect the user's toggle: if GPS was disabled while the OS task was
  // still alive, skip processing and do not submit any session.
  if (getSetting('gps_user_enabled', '0') !== '1') {
    console.log('TouchGrass: GPS task fired but GPS is disabled by user — skipping');
    return;
  }
  if (data?.locations?.length > 0) {
    const loc = data.locations[data.locations.length - 1];
    processLocationUpdate(
      loc.coords.latitude,
      loc.coords.longitude,
      loc.timestamp,
      loc.coords.speed ?? undefined
    );
    // Run dwell-based location suggestion after processing
    await autoDetectLocations();
  }
});
