jest.mock('../storage', () => ({
  getKnownLocationsAsync: jest.fn(),
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
  initDatabaseAsync: jest.fn(),
  insertBackgroundLogAsync: jest.fn(),
}));
jest.mock('../detection/sessionMerger');

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Database from '../storage';
import * as SessionMerger from '../detection/sessionMerger';
import {
  PROFILE_LOW_ACCURACY,
  PROFILE_HIGH_ACCURACY,
  MIN_RADIUS_METERS,
  MAX_RADIUS_METERS,
  MIN_OUTSIDE_DURATION_MS,
  LOCATION_TRACK_TASK,
} from '../detection/constants';
import {
  computeMinActiveRadius,
  isAtKnownIndoorLocation,
  shouldTriggerBurst,
  clampRadiusMeters,
} from '../detection/GeofenceManager';
import { LocationTracker } from '../detection/LocationTracker';

// Capture the task callback at file scope
const _defineTaskMock = TaskManager.defineTask as jest.Mock;
const _locationTrackCall = _defineTaskMock.mock.calls.find(
  ([name]: [string]) => name === LOCATION_TRACK_TASK
);
const _locationTrackCallback:
  | ((arg: { data: unknown; error: unknown }) => Promise<void>)
  | undefined = _locationTrackCall?.[1];

describe('isAtKnownIndoorLocation', () => {
  it('returns false when locations list is empty', () => {
    expect(isAtKnownIndoorLocation(51.5, 4.3, [])).toBe(false);
  });

  it('returns false when no indoor locations are nearby', () => {
    const locations = [
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active' as const,
      },
    ];
    // ~1km away — outside radius
    expect(isAtKnownIndoorLocation(51.51, 4.31, locations)).toBe(false);
  });

  it('returns true when within radius of an indoor location', () => {
    const locations = [
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active' as const,
      },
    ];
    // ~0m away — inside radius
    expect(isAtKnownIndoorLocation(51.5, 4.3, locations)).toBe(true);
  });

  it('ignores outdoor (non-indoor) locations', () => {
    const locations = [
      {
        id: 1,
        label: 'Park',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: false,
        status: 'active' as const,
      },
    ];
    expect(isAtKnownIndoorLocation(51.5, 4.3, locations)).toBe(false);
  });
});

describe('LocationTracker.processUpdate', () => {
  const NOW = 1_700_000_000_000;
  const tracker = LocationTracker.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    tracker.resetForTesting();

    // Default: no known locations → always "outside"
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([]);
    // Default: no persisted GPS state
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string, fallback: string) => fallback
    );
    (Database.setSettingAsync as jest.Mock).mockImplementation(async () => undefined);
    (SessionMerger.submitSession as jest.Mock).mockImplementation(async () => undefined);
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (
        startTime: number,
        endTime: number,
        source: string,
        confidence: number,
        notes?: string,
        provider?: string,
        distance?: number,
        speed?: number
      ) => ({
        startTime,
        endTime,
        durationMinutes: (endTime - startTime) / 60000,
        source,
        confidence,
        userConfirmed: null,
        notes,
        distanceMeters: distance,
        avgSpeedKmph: speed,
      })
    );
  });

  it('does not submit a session on the very first location update', async () => {
    await tracker.processUpdate(51.5, 4.3, NOW);
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('does not submit a session when duration is below minimum threshold', async () => {
    await tracker.processUpdate(51.5, 4.3, NOW);
    // Only 2 minutes later — below MIN_OUTSIDE_DURATION_MS
    await tracker.processUpdate(51.5001, 4.3001, NOW + 2 * 60 * 1000);
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('flushes a periodic session once MIN_OUTSIDE_DURATION_MS has elapsed (no indoor locations)', async () => {
    await tracker.processUpdate(51.5, 4.3, NOW);
    // MIN_OUTSIDE_DURATION_MS later → should flush
    await tracker.processUpdate(51.5001, 4.3001, NOW + MIN_OUTSIDE_DURATION_MS);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(NOW); // startTime
    expect(call[1]).toBe(NOW + MIN_OUTSIDE_DURATION_MS); // endTime
    expect(call[2]).toBe('gps');
  });

  it('resets the session start after a periodic flush', async () => {
    await tracker.processUpdate(51.5, 4.3, NOW);
    const T1 = NOW + MIN_OUTSIDE_DURATION_MS;
    await tracker.processUpdate(51.5001, 4.3001, T1); // first flush

    jest.clearAllMocks();
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([]);
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string, fallback: string) => fallback
    );

    // After reset, a further MIN_OUTSIDE_DURATION_MS elapsed → second flush
    const T2 = T1 + MIN_OUTSIDE_DURATION_MS;
    await tracker.processUpdate(51.5002, 4.3002, T2);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(T1); // new startTime is from after the previous flush
  });

  it('submits a session on indoor transition when known indoor location exists', async () => {
    const homeLocation = {
      id: 1,
      label: 'Home',
      latitude: 51.5,
      longitude: 4.3,
      radiusMeters: 100,
      isIndoor: true,
      status: 'active' as const,
    };

    // First update: user is outside (far from home — ~1 km away)
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([homeLocation]);
    await tracker.processUpdate(51.51, 4.31, NOW); // ~1km from home → outside, no start label

    // After MIN_OUTSIDE_DURATION_MS, user is back at home (indoor)
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([homeLocation]);
    await tracker.processUpdate(51.5, 4.3, NOW + MIN_OUTSIDE_DURATION_MS);

    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[2]).toBe('gps');
    const notes: string = call[4];
    expect(notes).toMatch(/GPS detection/i);
    expect(notes).toMatch(/Home/);
  });

  it('GPS notes include "left … and returned" when returning to same location', async () => {
    const homeLocation = {
      id: 1,
      label: 'Home',
      latitude: 51.5,
      longitude: 4.3,
      radiusMeters: 100,
      isIndoor: true,
      status: 'active' as const,
    };

    // Start near Home (just left it)
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([homeLocation]);
    await tracker.processUpdate(51.501, 4.301, NOW); // just left Home — nearby within 2×radius

    // Return to Home after minimum duration
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([homeLocation]);
    await tracker.processUpdate(51.5, 4.3, NOW + MIN_OUTSIDE_DURATION_MS);

    expect(SessionMerger.buildSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    const notes: string = call[4];
    expect(notes).toMatch(/left Home and returned/i);
  });

  it('GPS periodic notes include distance and speed info', async () => {
    // Speed provided: 1.39 m/s ≈ 5 km/h
    await tracker.processUpdate(51.5, 4.3, NOW, 1.39);
    await tracker.processUpdate(51.5001, 4.3001, NOW + MIN_OUTSIDE_DURATION_MS, 1.39);

    expect(SessionMerger.buildSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    const notes: string = call[4];
    expect(notes).toMatch(/GPS detection/i);
    expect(notes).toMatch(/(?:km|mi) at.*(?:km\/h|mph)/i);
  });

  it('persists GPS state by calling setSettingAsync after each update', async () => {
    await tracker.processUpdate(51.5, 4.3, NOW);
    expect(Database.setSettingAsync).toHaveBeenCalled();
  });

  it('restores persisted session start on loadState', async () => {
    const savedStart = NOW - MIN_OUTSIDE_DURATION_MS;
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string, fallback: string) => {
        if (key === 'gps_session_start') return String(savedStart);
        if (key === 'gps_last_outside') return '1';
        return fallback;
      }
    );

    await tracker.loadState();

    // First update after restart — duration already >= MIN → should flush immediately
    await tracker.processUpdate(51.5001, 4.3001, NOW);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(savedStart); // restored start time used
  });
});

describe('LOCATION_TRACK background task', () => {
  it('calls initDatabaseAsync to ensure schema migrations run', async () => {
    expect(_locationTrackCallback).toBeDefined();

    jest.clearAllMocks();
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (_k: string, fb: string) => fb
    );
    (Database.initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);

    await _locationTrackCallback!({ data: { locations: [] }, error: null });

    expect(Database.initDatabaseAsync).toHaveBeenCalled();
  });

  it('skips processing when GPS is disabled by the user', async () => {
    expect(_locationTrackCallback).toBeDefined();

    jest.clearAllMocks();
    LocationTracker.getInstance().resetForTesting();
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string, fallback: string) => {
        if (key === 'gps_enabled') return '0';
        return fallback;
      }
    );
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([]);

    await _locationTrackCallback!({
      data: {
        locations: [
          { coords: { latitude: 51.5, longitude: 4.3, speed: 0 }, timestamp: 1_700_000_000_000 },
        ],
      },
      error: null,
    });

    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
    expect(Database.setSettingAsync).not.toHaveBeenCalled();
  });
});

describe('LocationTracker.startTracking', () => {
  const tracker = LocationTracker.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('uses PROFILE_LOW_ACCURACY by default', async () => {
    await tracker.startTracking('low', 100);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      LOCATION_TRACK_TASK,
      expect.objectContaining({
        accuracy: PROFILE_LOW_ACCURACY,
      })
    );
  });

  it('uses PROFILE_HIGH_ACCURACY for the HIGH burst profile', async () => {
    await tracker.startTracking('high', 50);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      LOCATION_TRACK_TASK,
      expect.objectContaining({
        accuracy: PROFILE_HIGH_ACCURACY,
      })
    );
  });

  it('scales distanceInterval from minRadius', async () => {
    await tracker.startTracking('low', 50);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      LOCATION_TRACK_TASK,
      expect.objectContaining({
        distanceInterval: tracker.computeLowDistanceInterval(50),
      })
    );
  });
});

describe('GeofenceManager helpers', () => {
  it('MIN_RADIUS_METERS is 25', () => {
    expect(MIN_RADIUS_METERS).toBe(25);
  });

  it('MAX_RADIUS_METERS is 250', () => {
    expect(MAX_RADIUS_METERS).toBe(250);
  });

  it('clampRadiusMeters works as expected', () => {
    expect(clampRadiusMeters(0)).toBe(MIN_RADIUS_METERS);
    expect(clampRadiusMeters(1000)).toBe(MAX_RADIUS_METERS);
    expect(clampRadiusMeters(100)).toBe(100);
  });

  it('computeMinActiveRadius returns MAX_RADIUS_METERS when no locations', () => {
    expect(computeMinActiveRadius([])).toBe(MAX_RADIUS_METERS);
  });

  it('computeMinActiveRadius returns the smallest indoor radius', () => {
    const locations = [
      {
        id: 1,
        label: 'H',
        latitude: 0,
        longitude: 0,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active' as const,
      },
      {
        id: 2,
        label: 'W',
        latitude: 0,
        longitude: 0,
        radiusMeters: 50,
        isIndoor: true,
        status: 'active' as const,
      },
    ];
    expect(computeMinActiveRadius(locations)).toBe(50);
  });
});

describe('LocationTracker interval helpers', () => {
  const tracker = LocationTracker.getInstance();

  it('computeLowDistanceInterval is scaled correctly', () => {
    expect(tracker.computeLowDistanceInterval(100)).toBe(50);
    expect(tracker.computeLowDistanceInterval(25)).toBe(25);
  });

  it('computeHighDistanceInterval is scaled correctly', () => {
    expect(tracker.computeHighDistanceInterval(100)).toBe(20);
    expect(tracker.computeHighDistanceInterval(25)).toBe(10);
  });
});

describe('shouldTriggerBurst', () => {
  const NOW = 1_700_000_000_000;
  const smallHomeLocation = {
    id: 1,
    label: 'Home',
    latitude: 51.5,
    longitude: 4.3,
    radiusMeters: 50,
    isIndoor: true,
    status: 'active' as const,
  };

  it('returns true when user is near boundary', () => {
    const lat = 51.5005; // ~55m north
    expect(shouldTriggerBurst(lat, 4.3, [smallHomeLocation], NOW, 0, 'low')).toBe(true);
  });

  it('returns false during cooldown', () => {
    const lat = 51.5005;
    expect(shouldTriggerBurst(lat, 4.3, [smallHomeLocation], NOW, NOW - 1000, 'low')).toBe(false);
  });
});
