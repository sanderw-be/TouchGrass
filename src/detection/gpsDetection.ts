import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  getKnownLocations, upsertKnownLocation,
  getSetting, setSetting, KnownLocation,
} from '../storage/database';
import { submitSession, buildSession } from './sessionMerger';

const GEOFENCE_TASK = 'TOUCHGRASS_GEOFENCE';
const LOCATION_TRACK_TASK = 'TOUCHGRASS_LOCATION_TRACK';

const CONFIDENCE_GPS_ONLY = 0.80;
const CONFIDENCE_GPS_AND_ACTIVITY = 0.95;
const MIN_OUTSIDE_DURATION_MS = 5 * 60 * 1000;

// In-memory state for the current outside session
let outsideSessionStart: number | null = null;
let lastKnownOutside = false;

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
 */
export async function startLocationTracking(): Promise<void> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
  if (isTracking) return;

  await Location.startLocationUpdatesAsync(LOCATION_TRACK_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000,      // every 5 minutes
    distanceInterval: 100,              // or every 100 meters
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'TouchGrass',
      notificationBody: 'Tracking outside time in the background',
      notificationColor: '#4A7C59',
      notificationChannelId: 'touchgrass_background',
    },
    pausesUpdatesAutomatically: true,
  });
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
  locations: KnownLocation[],
): boolean {
  return locations.some((loc) => {
    if (!loc.isIndoor) return false;
    const dist = haversineDistance(lat, lon, loc.latitude, loc.longitude);
    return dist <= loc.radiusMeters;
  });
}

/**
 * Process a new location update.
 * Called by the background task.
 */
export function processLocationUpdate(lat: number, lon: number, timestamp: number): void {
  const knownLocations = getKnownLocations();
  const isIndoor = isAtKnownIndoorLocation(lat, lon, knownLocations);
  const isOutside = !isIndoor;

  if (isOutside && !lastKnownOutside) {
    // Just went outside
    outsideSessionStart = timestamp;
    lastKnownOutside = true;
  } else if (!isOutside && lastKnownOutside && outsideSessionStart !== null) {
    // Just came back inside
    const duration = timestamp - outsideSessionStart;
    if (duration >= MIN_OUTSIDE_DURATION_MS) {
      const session = buildSession(
        outsideSessionStart,
        timestamp,
        'gps',
        CONFIDENCE_GPS_ONLY,
        'GPS geofence exit/return',
      );
      submitSession(session);
    }
    outsideSessionStart = null;
    lastKnownOutside = false;
  }

  // Update location clusters for auto-detect
  recordLocationForClustering(lat, lon, timestamp);
}

/**
 * Auto-detect home and work from location history.
 * Clusters locations visited during:
 * - Nights (10pm–7am) → home
 * - Weekday mornings/afternoons (9am–5pm) → work
 */
export async function autoDetectLocations(): Promise<void> {
  try {
    const rawClusters = getSetting('location_clusters', '[]');
    const clusters: LocationSample[] = JSON.parse(rawClusters);

    if (clusters.length < 20) return; // not enough data yet

    const homeSamples = clusters.filter((s) => {
      const h = new Date(s.timestamp).getHours();
      return h >= 22 || h < 7;
    });

    const workSamples = clusters.filter((s) => {
      const d = new Date(s.timestamp).getDay();
      const h = new Date(s.timestamp).getHours();
      return d >= 1 && d <= 5 && h >= 9 && h < 17;
    });

    const homeCenter = centroid(homeSamples);
    const workCenter = centroid(workSamples);

    if (homeCenter && !getSetting('home_detected', '')) {
      upsertKnownLocation({
        label: 'Home',
        latitude: homeCenter.lat,
        longitude: homeCenter.lon,
        radiusMeters: 100,
        isIndoor: true,
      });
      setSetting('home_detected', '1');
    }

    if (workCenter && !getSetting('work_detected', '')) {
      // Only set work if it's meaningfully far from home
      if (!homeCenter || haversineDistance(
        workCenter.lat, workCenter.lon,
        homeCenter.lat, homeCenter.lon
      ) > 200) {
        upsertKnownLocation({
          label: 'Work',
          latitude: workCenter.lat,
          longitude: workCenter.lon,
          radiusMeters: 100,
          isIndoor: true,
        });
        setSetting('work_detected', '1');
      }
    }
  } catch (e) {
    console.warn('Auto-detect locations error:', e);
  }
}

// ── Location clustering helpers ───────────────────────────

interface LocationSample {
  lat: number;
  lon: number;
  timestamp: number;
}

const MAX_CLUSTER_SAMPLES = 500;

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

function centroid(samples: LocationSample[]): { lat: number; lon: number } | null {
  if (samples.length === 0) return null;
  const lat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length;
  const lon = samples.reduce((sum, s) => sum + s.lon, 0) / samples.length;
  return { lat, lon };
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

TaskManager.defineTask(LOCATION_TRACK_TASK, ({ data, error }: any) => {
  if (error) {
    console.warn('Location task error:', error);
    return;
  }
  if (data?.locations?.length > 0) {
    const loc = data.locations[data.locations.length - 1];
    processLocationUpdate(
      loc.coords.latitude,
      loc.coords.longitude,
      loc.timestamp,
    );
  }
});
