import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  getKnownLocationsAsync,
  getAllKnownLocationsAsync,
  getSettingAsync,
  upsertKnownLocationAsync,
  KnownLocation,
} from '../storage';
import { haversineDistance } from './utils';
import {
  MIN_RADIUS_METERS,
  MAX_RADIUS_METERS,
  BURST_RADIUS_THRESHOLD_M,
  BURST_BOUNDARY_FRACTION,
  MIN_BOUNDARY_MARGIN_M,
  BURST_COOLDOWN_MS,
  CLUSTER_DETECTION_RADIUS_M,
} from './constants';
import { t } from '../i18n';

export interface LocationSample {
  lat: number;
  lon: number;
  timestamp: number;
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
 * Check if a coordinate is inside any known location (indoor or outdoor).
 */
export function isAtAnyKnownLocation(
  lat: number,
  lon: number,
  locations: KnownLocation[]
): boolean {
  return locations.some((loc) => {
    const dist = haversineDistance(lat, lon, loc.latitude, loc.longitude);
    return dist <= loc.radiusMeters;
  });
}

/**
 * Returns true if every GPS cluster sample within [startMs, endMs] falls inside
 * a known indoor location — meaning the user was definitely not outside.
 */
export function wasDefinitelyAtKnownIndoorLocationSync(
  startMs: number,
  endMs: number,
  allSamples: LocationSample[],
  knownLocations: KnownLocation[]
): boolean {
  const sessionSamples = allSamples.filter((s) => s.timestamp >= startMs && s.timestamp <= endMs);
  if (sessionSamples.length === 0) return false;
  if (knownLocations.length === 0) return false;

  return sessionSamples.every((sample) =>
    isAtKnownIndoorLocation(sample.lat, sample.lon, knownLocations)
  );
}

/**
 * Decide whether a HIGH accuracy burst should be triggered for the current
 * position.
 */
export function shouldTriggerBurst(
  lat: number,
  lon: number,
  locations: KnownLocation[],
  now: number,
  lastBurstAtTimestamp: number,
  currentProfile: 'low' | 'high',
  locationAccuracy?: number
): boolean {
  if (currentProfile === 'high') return false;
  if (now - lastBurstAtTimestamp < BURST_COOLDOWN_MS) return false;

  for (const loc of locations) {
    if (!loc.isIndoor) continue;
    if (loc.radiusMeters > BURST_RADIUS_THRESHOLD_M) continue;

    const d = haversineDistance(lat, lon, loc.latitude, loc.longitude);
    const boundaryDelta = Math.abs(d - loc.radiusMeters);
    const margin = Math.max(MIN_BOUNDARY_MARGIN_M, loc.radiusMeters * BURST_BOUNDARY_FRACTION);

    const nearBoundary = boundaryDelta <= margin;
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
 * Compute the minimum active geofence radius across all active known locations.
 */
export function computeMinActiveRadius(locations: KnownLocation[]): number {
  const activeIndoor = locations.filter((l) => l.isIndoor);
  if (activeIndoor.length === 0) return MAX_RADIUS_METERS;
  const minR = Math.min(...activeIndoor.map((l) => l.radiusMeters));
  return clampRadiusMeters(minR);
}

/**
 * Clamp a radius between MIN and MAX.
 */
export function clampRadiusMeters(radius: number): number {
  return Math.max(MIN_RADIUS_METERS, Math.min(MAX_RADIUS_METERS, radius));
}

export interface LocationCluster {
  samples: LocationSample[];
  totalDwellMs: number;
  avgLat: number;
  avgLon: number;
}

/** @internal */
export function createClusterObject(samples: LocationSample[]): LocationCluster {
  const start = Math.min(...samples.map((s) => s.timestamp));
  const end = Math.max(...samples.map((s) => s.timestamp));
  const avgLat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length;
  const avgLon = samples.reduce((sum, s) => sum + s.lon, 0) / samples.length;
  return {
    samples,
    totalDwellMs: end - start,
    avgLat,
    avgLon,
  };
}

/**
 * Group samples into spatial clusters, respecting a maximum time gap between samples.
 */
export function computeDwellClusters(samples: LocationSample[]): LocationCluster[] {
  if (samples.length < 2) return [];

  const MAX_DWELL_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);

  const segments: LocationSample[][] = [];
  let currentSegment: LocationSample[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.timestamp - prev.timestamp;

    if (gap > MAX_DWELL_GAP_MS) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  const clusters: LocationCluster[] = [];

  for (const segment of segments) {
    let currentClusterSamples: LocationSample[] = [segment[0]];

    for (let i = 1; i < segment.length; i++) {
      const prev = segment[i - 1];
      const curr = segment[i];
      const dist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

      if (dist > CLUSTER_DETECTION_RADIUS_M) {
        if (currentClusterSamples.length >= 2) {
          clusters.push(createClusterObject(currentClusterSamples));
        }
        currentClusterSamples = [curr];
      } else {
        currentClusterSamples.push(curr);
      }
    }
    if (currentClusterSamples.length >= 2) {
      clusters.push(createClusterObject(currentClusterSamples));
    }
  }

  return clusters;
}

/**
 * Auto-detect frequently-visited locations from GPS dwell time.
 */
export async function autoDetectLocations(): Promise<void> {
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  if ((await getSettingAsync('location_suggestions_enabled', '1')) !== '1') return;

  try {
    const rawClusters = await getSettingAsync('location_clusters', '[]');
    const samples: LocationSample[] = JSON.parse(rawClusters);
    if (samples.length < 10) return;

    const knownLocations = await getKnownLocationsAsync();
    const thresholdHours = knownLocations.length === 0 ? 2 : 3;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;

    const clusters = computeDwellClusters(samples);
    const allKnownLocations = await getAllKnownLocationsAsync();

    for (const cluster of clusters) {
      if (cluster.totalDwellMs >= thresholdMs) {
        const alreadyKnown = allKnownLocations.some(
          (loc) =>
            haversineDistance(cluster.avgLat, cluster.avgLon, loc.latitude, loc.longitude) <=
            CLUSTER_DETECTION_RADIUS_M
        );

        if (!alreadyKnown) {
          await upsertKnownLocationAsync({
            label: t('location_suggested_label'),
            latitude: cluster.avgLat,
            longitude: cluster.avgLon,
            radiusMeters: 100,
            isIndoor: true,
            status: 'suggested',
          });
          await sendLocationSuggestionNotification();
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Auto-detect locations error:', e);
  }
}

async function sendLocationSuggestionNotification(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_location_suggestion_title'),
        body: t('notif_location_suggestion_body'),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Error sending location suggestion notification:', e);
  }
}
