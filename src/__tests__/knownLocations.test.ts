jest.mock('../storage/database');
jest.mock('../detection/sessionMerger');

import * as Database from '../storage/database';
import {
  computeDwellClusters,
  autoDetectLocations,
  _resetGPSStateForTesting,
} from '../detection/gpsDetection';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

// ── computeDwellClusters ──────────────────────────────────

describe('computeDwellClusters', () => {
  const BASE_TIME = 1_700_000_000_000;
  const FIVE_MIN = 5 * 60 * 1000;

  it('returns empty array for fewer than 2 samples', () => {
    expect(computeDwellClusters([])).toEqual([]);
    expect(computeDwellClusters([{ lat: 51.5, lon: 4.3, timestamp: BASE_TIME }])).toEqual([]);
  });

  it('accumulates dwell time for consecutive samples within 100m', () => {
    // 3 samples 5 minutes apart, all within a few meters of each other
    const samples = [
      { lat: 51.5, lon: 4.3, timestamp: BASE_TIME },
      { lat: 51.5001, lon: 4.3001, timestamp: BASE_TIME + FIVE_MIN },
      { lat: 51.5002, lon: 4.3002, timestamp: BASE_TIME + 2 * FIVE_MIN },
    ];
    const clusters = computeDwellClusters(samples);
    expect(clusters.length).toBe(1);
    // Two intervals of 5 minutes each → 10 minutes total
    expect(clusters[0].totalDwellMs).toBe(2 * FIVE_MIN);
  });

  it('does not accumulate dwell time for samples far apart (>100m)', () => {
    // Two samples ~1km apart
    const samples = [
      { lat: 51.5, lon: 4.3, timestamp: BASE_TIME },
      { lat: 51.51, lon: 4.31, timestamp: BASE_TIME + FIVE_MIN },
    ];
    const clusters = computeDwellClusters(samples);
    expect(clusters.length).toBe(0);
  });

  it('does not accumulate dwell time for samples with a gap > 2 hours', () => {
    const TWO_HOURS_PLUS = 2 * 60 * 60 * 1000 + 1;
    const samples = [
      { lat: 51.5, lon: 4.3, timestamp: BASE_TIME },
      { lat: 51.5001, lon: 4.3001, timestamp: BASE_TIME + TWO_HOURS_PLUS },
    ];
    const clusters = computeDwellClusters(samples);
    expect(clusters.length).toBe(0);
  });

  it('creates separate clusters for geographically distinct locations', () => {
    // First location: home (~51.5, 4.3)
    const homeSamples = Array.from({ length: 3 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    // Second location: work (~51.52, 4.32) — ~2 km away
    const workSamples = Array.from({ length: 3 }, (_, i) => ({
      lat: 51.52,
      lon: 4.32,
      timestamp: BASE_TIME + 60 * 60 * 1000 + i * FIVE_MIN, // 1 hour later
    }));
    const clusters = computeDwellClusters([...homeSamples, ...workSamples]);
    // Should have 2 separate clusters
    expect(clusters.length).toBe(2);
  });

  it('accumulates 2h+ dwell for enough samples (simulates home detection threshold)', () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    // 25 samples × 5 minutes = 120 minutes = 2 hours of dwell
    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    const clusters = computeDwellClusters(samples);
    expect(clusters.length).toBe(1);
    expect(clusters[0].totalDwellMs).toBeGreaterThanOrEqual(TWO_HOURS_MS);
  });
});

// ── autoDetectLocations ───────────────────────────────────

describe('autoDetectLocations', () => {
  const BASE_TIME = 1_700_000_000_000;
  const FIVE_MIN = 5 * 60 * 1000;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetGPSStateForTesting();

    // GPS permissions granted by default
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    // Notification permissions granted by default
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(undefined);

    // Default: suggestions enabled, no existing locations, empty clusters
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return '[]';
      return fallback;
    });
    (Database.getKnownLocations as jest.Mock).mockReturnValue([]);
    (Database.getAllKnownLocations as jest.Mock).mockReturnValue([]);
    (Database.upsertKnownLocation as jest.Mock).mockImplementation(() => undefined);
  });

  it('returns early when GPS permission is not granted', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await autoDetectLocations();
    expect(Database.upsertKnownLocation).not.toHaveBeenCalled();
  });

  it('returns early when location suggestions are disabled', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '0';
      return fallback;
    });
    await autoDetectLocations();
    expect(Database.upsertKnownLocation).not.toHaveBeenCalled();
  });

  it('returns early when fewer than 10 samples are available', async () => {
    const fewSamples = Array.from({ length: 5 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(fewSamples);
      return fallback;
    });
    await autoDetectLocations();
    expect(Database.upsertKnownLocation).not.toHaveBeenCalled();
  });

  it('suggests a location after 2h+ dwell with no known locations', async () => {
    // 25 samples × 5 min = 120 min at same location
    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    expect(Database.upsertKnownLocation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suggested', label: '' })
    );
  });

  it('uses 3h threshold when known locations already exist', async () => {
    // Mock: 1 known active location exists
    (Database.getKnownLocations as jest.Mock).mockReturnValue([
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);
    (Database.getAllKnownLocations as jest.Mock).mockReturnValue([
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);

    // 25 samples × 5 min at a NEW location — only 2h dwell, below 3h threshold
    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.52,
      lon: 4.32,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    // 2h dwell < 3h threshold → should NOT suggest
    expect(Database.upsertKnownLocation).not.toHaveBeenCalled();
  });

  it('suggests a location after 3h+ dwell when known locations already exist', async () => {
    // Mock: 1 known active location exists
    (Database.getKnownLocations as jest.Mock).mockReturnValue([
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);
    (Database.getAllKnownLocations as jest.Mock).mockReturnValue([
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);

    // 37 samples × 5 min at a NEW location — 3h dwell, meets 3h threshold
    const samples = Array.from({ length: 37 }, (_, i) => ({
      lat: 51.52,
      lon: 4.32,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    // 3h dwell >= 3h threshold → should suggest
    expect(Database.upsertKnownLocation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suggested', label: '' })
    );
  });

  it('does not re-suggest a place already tracked in known locations', async () => {
    // Known active location at same place as dwell
    (Database.getAllKnownLocations as jest.Mock).mockReturnValue([
      {
        id: 1,
        label: 'Home',
        latitude: 51.5,
        longitude: 4.3,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);

    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    expect(Database.upsertKnownLocation).not.toHaveBeenCalled();
  });

  it('sends a notification when a location is suggested', async () => {
    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ channelId: 'touchgrass_reminders' }),
      })
    );
  });

  it('does not send a notification when notification permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const samples = Array.from({ length: 25 }, (_, i) => ({
      lat: 51.5,
      lon: 4.3,
      timestamp: BASE_TIME + i * FIVE_MIN,
    }));
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_suggestions_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(samples);
      return fallback;
    });

    await autoDetectLocations();

    // Location should still be suggested but notification skipped
    expect(Database.upsertKnownLocation).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

// ── database functions for known locations ────────────────

describe('database known location functions', () => {
  it('exports getAllKnownLocations', () => {
    expect(typeof Database.getAllKnownLocations).toBe('function');
  });

  it('exports getSuggestedLocations', () => {
    expect(typeof Database.getSuggestedLocations).toBe('function');
  });

  it('exports approveKnownLocation', () => {
    expect(typeof Database.approveKnownLocation).toBe('function');
  });

  it('exports denyKnownLocation', () => {
    expect(typeof Database.denyKnownLocation).toBe('function');
  });
});
