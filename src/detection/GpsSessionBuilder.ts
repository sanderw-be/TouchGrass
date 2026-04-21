import { t } from '../i18n';
import { isImperialUnits, kmToMiles, kmhToMph } from '../utils/units';

/**
 * Build a human-readable description for a GPS session.
 * Example (metric):   "GPS detection, left Home and returned for 2.3 km at 4.5 km/h."
 * Example (imperial): "GPS detection, left Home and returned for 1.4 mi at 2.8 mph."
 */
export function buildGpsNotes(
  startLocationLabel: string | null,
  endLocationLabel: string | null,
  distanceMeters: number,
  averageSpeedKmh: number
): string {
  const imperial = isImperialUnits();
  const distKm = distanceMeters / 1000;
  const dist = imperial ? kmToMiles(distKm).toFixed(1) : distKm.toFixed(1);
  const speed = imperial ? kmhToMph(averageSpeedKmh).toFixed(1) : averageSpeedKmh.toFixed(1);
  const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');

  // Let's stick closer to original buildGpsNotes:
  const originalDistUnit = imperial ? 'mi' : 'km';

  if (startLocationLabel && endLocationLabel) {
    if (startLocationLabel === endLocationLabel) {
      return t('session_notes_gps_left_returned', {
        start: startLocationLabel,
        dist,
        distUnit: originalDistUnit,
        speed,
        speedUnit,
      });
    }
    return t('session_notes_gps_left_went', {
      start: startLocationLabel,
      end: endLocationLabel,
      dist,
      distUnit: originalDistUnit,
      speed,
      speedUnit,
    });
  }
  if (startLocationLabel) {
    return t('session_notes_gps_left', {
      start: startLocationLabel,
      dist,
      distUnit: originalDistUnit,
      speed,
      speedUnit,
    });
  }
  if (endLocationLabel) {
    return t('session_notes_gps_returned', {
      end: endLocationLabel,
      dist,
      distUnit: originalDistUnit,
      speed,
      speedUnit,
    });
  }
  return t('session_notes_gps_no_location', { dist, distUnit: originalDistUnit, speed, speedUnit });
}
