import * as Location from 'expo-location';

export const LOCATION_TRACK_TASK = 'TOUCHGRASS_LOCATION_TRACK';

export const CONFIDENCE_GPS_ONLY = 0.8;
export const MIN_OUTSIDE_DURATION_MS = 5 * 60 * 1000;

/** Accuracy used during the default LOW tracking profile. */
export const PROFILE_LOW_ACCURACY = Location.Accuracy.Lowest;
/** Accuracy used during a HIGH burst. */
export const PROFILE_HIGH_ACCURACY = Location.Accuracy.Balanced;

/** How long a HIGH burst lasts before reverting to LOW (ms). */
export const BURST_DURATION_MS = 60_000; // 60 seconds
/** Minimum gap between two consecutive HIGH bursts (ms). */
export const BURST_COOLDOWN_MS = 10 * 60_000; // 10 minutes

/** Minimum configurable geofence radius in metres. */
export const MIN_RADIUS_METERS = 25;
/** Maximum configurable geofence radius in metres. */
export const MAX_RADIUS_METERS = 250;

/**
 * Radius threshold below which a geofence is considered "small" and therefore
 * eligible for a burst when the user is near the boundary.
 */
export const BURST_RADIUS_THRESHOLD_M = 75;
/**
 * A burst is triggered when the user is within this fraction of the geofence
 * radius from the boundary (or at least MIN_BOUNDARY_MARGIN_M, whichever is
 * larger).
 */
export const BURST_BOUNDARY_FRACTION = 0.25;
export const MIN_BOUNDARY_MARGIN_M = 20;

/**
 * Radius (metres) used when deciding if two GPS points are "at the same place"
 * for dwell-time clustering.
 */
export const CLUSTER_DETECTION_RADIUS_M = 100;

// Health Connect constants
export const CONFIDENCE_ACTIVITY = 0.7;
export const MIN_DURATION_MS = 3 * 60 * 1000; // 3 minutes
export const STEPS_PER_MINUTE_AT_5KMH = 110;
export const STEPS_PER_MIN_AT_2_5KMH = 55;
export const STEPS_PER_MIN_AT_4KMH = 88;
export const BASELINE_SPEED_KMH = 5;
export const CONFIDENCE_SLOW_WALK = 0.5;

export const HC_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
