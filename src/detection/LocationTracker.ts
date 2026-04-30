import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  getKnownLocationsAsync,
  getSettingAsync,
  setSettingAsync,
  insertBackgroundLogAsync,
  initDatabaseAsync,
} from '../storage';
import { submitSession, buildSession } from './sessionMerger';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { haversineDistance } from './utils';
import {
  LOCATION_TRACK_TASK,
  PROFILE_LOW_ACCURACY,
  PROFILE_HIGH_ACCURACY,
  BURST_DURATION_MS,
  MAX_RADIUS_METERS,
  MIN_OUTSIDE_DURATION_MS,
  CONFIDENCE_GPS_ONLY,
} from './constants';
import {
  isAtKnownIndoorLocation,
  shouldTriggerBurst,
  computeMinActiveRadius,
  autoDetectLocations,
} from './GeofenceManager';
import { buildGpsNotes } from './GpsSessionBuilder';
import { t } from '../i18n';
import { colors } from '../utils/theme';

// Persistence keys
const GPS_SESSION_START_KEY = 'gps_session_start';
const GPS_LAST_OUTSIDE_KEY = 'gps_last_outside';
const GPS_PROFILE_KEY = 'gps_tracking_profile';
const GPS_BURST_UNTIL_KEY = 'gps_burst_until';
const GPS_LAST_BURST_KEY = 'gps_last_burst';

const DEPARTURE_LOCATION_RADIUS_MULTIPLIER = 2;

export class LocationTracker {
  private static instance: LocationTracker;

  private outsideSessionStart: number | null = null;
  private lastKnownOutside = false;
  private gpsSessionDistanceMeters = 0;
  private gpsSessionSpeedSum = 0;
  private gpsSessionSpeedCount = 0;
  private gpsSessionStartLocationLabel: string | null = null;
  private gpsSessionLastLat: number | null = null;
  private gpsSessionLastLon: number | null = null;
  private lastLoggedIndoorLocation: string | null | undefined = undefined;

  private currentProfile: 'low' | 'high' = 'low';
  private burstUntilTimestamp = 0;
  private lastBurstAtTimestamp = 0;

  private constructor() {}

  public static getInstance(): LocationTracker {
    if (!LocationTracker.instance) {
      LocationTracker.instance = new LocationTracker();
    }
    return LocationTracker.instance;
  }

  public async loadState(): Promise<void> {
    const [startRaw, outsideRaw, profileRaw, burstUntilRaw, lastBurstRaw] = await Promise.all([
      getSettingAsync(GPS_SESSION_START_KEY, '0'),
      getSettingAsync(GPS_LAST_OUTSIDE_KEY, '0'),
      getSettingAsync(GPS_PROFILE_KEY, 'low'),
      getSettingAsync(GPS_BURST_UNTIL_KEY, '0'),
      getSettingAsync(GPS_LAST_BURST_KEY, '0'),
    ]);
    const start = parseInt(startRaw, 10);
    this.outsideSessionStart = start > 0 ? start : null;
    this.lastKnownOutside = outsideRaw === '1';
    this.currentProfile = profileRaw as 'low' | 'high';
    this.burstUntilTimestamp = parseInt(burstUntilRaw, 10);
    this.lastBurstAtTimestamp = parseInt(lastBurstRaw, 10);
  }

  public async saveState(): Promise<void> {
    await Promise.all([
      setSettingAsync(GPS_SESSION_START_KEY, String(this.outsideSessionStart ?? 0)),
      setSettingAsync(GPS_LAST_OUTSIDE_KEY, this.lastKnownOutside ? '1' : '0'),
      setSettingAsync(GPS_PROFILE_KEY, this.currentProfile),
      setSettingAsync(GPS_BURST_UNTIL_KEY, String(this.burstUntilTimestamp)),
      setSettingAsync(GPS_LAST_BURST_KEY, String(this.lastBurstAtTimestamp)),
    ]);
  }

  public async startTracking(
    profile: 'low' | 'high' = 'low',
    minRadiusMeters: number = MAX_RADIUS_METERS
  ): Promise<void> {
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    const { status: bg } = await Location.getBackgroundPermissionsAsync();

    if (fg !== 'granted' || bg !== 'granted') return;

    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
    if (isTracking) return;

    this.currentProfile = profile;
    await Location.startLocationUpdatesAsync(
      LOCATION_TRACK_TASK,
      this.buildLocationOptions(profile, minRadiusMeters)
    );
  }

  public async stopTracking(): Promise<void> {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACK_TASK);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACK_TASK);
    }
  }

  public async switchProfile(profile: 'low' | 'high', minRadiusMeters: number): Promise<void> {
    await this.stopTracking();
    this.currentProfile = profile;
    await Location.startLocationUpdatesAsync(
      LOCATION_TRACK_TASK,
      this.buildLocationOptions(profile, minRadiusMeters)
    );
  }

  public buildLocationOptions(
    profile: 'low' | 'high',
    minRadiusMeters: number
  ): Location.LocationTaskOptions {
    const foregroundService = {
      notificationTitle: 'TouchGrass',
      notificationBody: t('gps_tracking_notif_body'),
      notificationColor: colors.grass,
    };

    if (profile === 'high') {
      return {
        accuracy: PROFILE_HIGH_ACCURACY,
        timeInterval: 15_000,
        distanceInterval: this.computeHighDistanceInterval(minRadiusMeters),
        showsBackgroundLocationIndicator: false,
        foregroundService,
        pausesUpdatesAutomatically: false,
      };
    }

    return {
      accuracy: PROFILE_LOW_ACCURACY,
      timeInterval: 5 * 60 * 1000,
      distanceInterval: this.computeLowDistanceInterval(minRadiusMeters),
      showsBackgroundLocationIndicator: false,
      foregroundService,
      pausesUpdatesAutomatically: false,
    };
  }

  public computeLowDistanceInterval(minRadiusMeters: number): number {
    return Math.max(25, Math.min(125, Math.round(minRadiusMeters * 0.5)));
  }

  public computeHighDistanceInterval(minRadiusMeters: number): number {
    return Math.max(10, Math.min(50, Math.round(minRadiusMeters * 0.2)));
  }

  public async processUpdate(
    lat: number,
    lon: number,
    timestamp: number,
    speedMs?: number
  ): Promise<void> {
    const knownLocations = await getKnownLocationsAsync();
    const isIndoor = isAtKnownIndoorLocation(lat, lon, knownLocations);
    const isOutside = !isIndoor;

    if (
      this.lastKnownOutside &&
      this.gpsSessionLastLat !== null &&
      this.gpsSessionLastLon !== null
    ) {
      const segDist = haversineDistance(this.gpsSessionLastLat, this.gpsSessionLastLon, lat, lon);
      this.gpsSessionDistanceMeters += segDist;
    }

    if (speedMs != null && speedMs >= 0) {
      this.gpsSessionSpeedSum += speedMs * 3.6;
      this.gpsSessionSpeedCount++;
    }

    this.gpsSessionLastLat = lat;
    this.gpsSessionLastLon = lon;

    if (isOutside && !this.lastKnownOutside) {
      const departureLocation = knownLocations.find(
        (loc) =>
          loc.isIndoor &&
          haversineDistance(lat, lon, loc.latitude, loc.longitude) <=
            loc.radiusMeters * DEPARTURE_LOCATION_RADIUS_MULTIPLIER
      );
      this.gpsSessionStartLocationLabel = departureLocation?.label ?? null;
      this.outsideSessionStart = timestamp;
      this.lastKnownOutside = true;
      this.resetSessionStats();
      await insertBackgroundLogAsync(
        'gps',
        this.gpsSessionStartLocationLabel
          ? `Left ${this.gpsSessionStartLocationLabel} — outside`
          : 'Outside (no known location)'
      );
    } else if (!isOutside && this.lastKnownOutside && this.outsideSessionStart !== null) {
      const duration = timestamp - this.outsideSessionStart;
      const matchedLocation = knownLocations.find(
        (loc) =>
          loc.isIndoor &&
          haversineDistance(lat, lon, loc.latitude, loc.longitude) <= loc.radiusMeters
      );
      const locationLabel = matchedLocation?.label || `(${lat.toFixed(4)}, ${lon.toFixed(4)})`;

      if (duration >= MIN_OUTSIDE_DURATION_MS) {
        const avgSpeed =
          this.gpsSessionSpeedCount > 0 ? this.gpsSessionSpeedSum / this.gpsSessionSpeedCount : 0;
        const notes = buildGpsNotes(
          this.gpsSessionStartLocationLabel,
          matchedLocation?.label ?? null,
          this.gpsSessionDistanceMeters,
          avgSpeed
        );
        await submitSession(
          buildSession(
            this.outsideSessionStart,
            timestamp,
            'gps',
            CONFIDENCE_GPS_ONLY,
            notes,
            undefined,
            this.gpsSessionDistanceMeters > 0 ? this.gpsSessionDistanceMeters : undefined,
            this.gpsSessionSpeedCount > 0
              ? this.gpsSessionSpeedSum / this.gpsSessionSpeedCount
              : undefined
          )
        );
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
      this.outsideSessionStart = null;
      this.lastKnownOutside = false;
      this.resetSessionStats();
      this.gpsSessionStartLocationLabel = null;
    } else if (isOutside && this.lastKnownOutside && this.outsideSessionStart !== null) {
      const duration = timestamp - this.outsideSessionStart;
      if (duration >= MIN_OUTSIDE_DURATION_MS) {
        const avgSpeed =
          this.gpsSessionSpeedCount > 0 ? this.gpsSessionSpeedSum / this.gpsSessionSpeedCount : 0;
        const notes = buildGpsNotes(
          this.gpsSessionStartLocationLabel,
          null,
          this.gpsSessionDistanceMeters,
          avgSpeed
        );
        await submitSession(
          buildSession(
            this.outsideSessionStart,
            timestamp,
            'gps',
            CONFIDENCE_GPS_ONLY,
            notes,
            undefined,
            this.gpsSessionDistanceMeters > 0 ? this.gpsSessionDistanceMeters : undefined,
            this.gpsSessionSpeedCount > 0
              ? this.gpsSessionSpeedSum / this.gpsSessionSpeedCount
              : undefined
          )
        );
        emitSessionsChanged();
        this.outsideSessionStart = timestamp;
        this.resetSessionStats();
      }
    }

    await this.saveState();

    if (!isOutside && !this.lastKnownOutside) {
      const matchedLocation = knownLocations.find(
        (loc) =>
          loc.isIndoor &&
          haversineDistance(lat, lon, loc.latitude, loc.longitude) <= loc.radiusMeters
      );
      const label = matchedLocation?.label ?? null;
      if (label !== null && label !== this.lastLoggedIndoorLocation) {
        await insertBackgroundLogAsync('gps', `Inside at ${label}`);
        this.lastLoggedIndoorLocation = label;
      }
    } else if (isOutside) {
      this.lastLoggedIndoorLocation = null;
    }
  }

  private resetSessionStats() {
    this.gpsSessionDistanceMeters = 0;
    this.gpsSessionSpeedSum = 0;
    this.gpsSessionSpeedCount = 0;
  }

  /** @internal */
  public resetForTesting() {
    this.outsideSessionStart = null;
    this.lastKnownOutside = false;
    this.gpsSessionDistanceMeters = 0;
    this.gpsSessionSpeedSum = 0;
    this.gpsSessionSpeedCount = 0;
    this.gpsSessionStartLocationLabel = null;
    this.gpsSessionLastLat = null;
    this.gpsSessionLastLon = null;
    this.currentProfile = 'low';
    this.burstUntilTimestamp = 0;
    this.lastBurstAtTimestamp = 0;
  }

  // Getters for profile management
  public getProfile() {
    return this.currentProfile;
  }
  public getBurstUntil() {
    return this.burstUntilTimestamp;
  }
  public getLastBurstAt() {
    return this.lastBurstAtTimestamp;
  }

  public setBurst(until: number, at: number) {
    this.burstUntilTimestamp = until;
    this.lastBurstAtTimestamp = at;
  }
}

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
    await initDatabaseAsync();
    const tracker = LocationTracker.getInstance();
    await tracker.loadState();

    if ((await getSettingAsync('gps_enabled', '0')) !== '1') {
      return;
    }

    if (data?.locations?.length > 0) {
      const loc = data.locations[data.locations.length - 1];
      const now = loc.timestamp;
      await tracker.processUpdate(
        loc.coords.latitude,
        loc.coords.longitude,
        now,
        loc.coords.speed ?? undefined
      );

      const activeLocations = await getKnownLocationsAsync();
      const minRadius = computeMinActiveRadius(activeLocations);

      if (tracker.getProfile() === 'high' && now >= tracker.getBurstUntil()) {
        await insertBackgroundLogAsync('gps', 'Burst expired — reverting to LOW profile');
        tracker.setBurst(0, tracker.getLastBurstAt());
        await tracker.saveState();
        try {
          await tracker.switchProfile('low', minRadius);
        } catch (e) {
          console.warn('TouchGrass: Failed to switch back to LOW profile', e);
        }
      } else if (
        tracker.getProfile() === 'low' &&
        shouldTriggerBurst(
          loc.coords.latitude,
          loc.coords.longitude,
          activeLocations,
          now,
          tracker.getLastBurstAt(),
          tracker.getProfile(),
          loc.coords.accuracy ?? undefined
        )
      ) {
        tracker.setBurst(now + BURST_DURATION_MS, now);
        await insertBackgroundLogAsync('gps', `Burst triggered (minRadius=${minRadius}m)`);
        await tracker.saveState();
        try {
          await tracker.switchProfile('high', minRadius);
        } catch (e) {
          console.warn('TouchGrass: Failed to switch to HIGH burst profile', e);
        }
      }

      await autoDetectLocations();
    }
  }
);
