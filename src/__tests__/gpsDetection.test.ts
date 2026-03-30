jest.mock('../storage/database');
jest.mock('../detection/sessionMerger');

import * as Database from '../storage/database';
import * as SessionMerger from '../detection/sessionMerger';
import {
  processLocationUpdate,
  isAtKnownIndoorLocation,
  _resetGPSStateForTesting,
  MIN_OUTSIDE_DURATION_MS,
} from '../detection/gpsDetection';

describe('isAtKnownIndoorLocation', () => {
  it('returns false when locations list is empty', () => {
    expect(isAtKnownIndoorLocation(51.5, 4.3, [])).toBe(false);
  });

  it('returns false when no indoor locations are nearby', () => {
    const locations = [
      { id: 1, label: 'Home', latitude: 51.5, longitude: 4.3, radiusMeters: 100, isIndoor: true, status: 'active' as const },
    ];
    // ~1km away — outside radius
    expect(isAtKnownIndoorLocation(51.51, 4.31, locations)).toBe(false);
  });

  it('returns true when within radius of an indoor location', () => {
    const locations = [
      { id: 1, label: 'Home', latitude: 51.5, longitude: 4.3, radiusMeters: 100, isIndoor: true, status: 'active' as const },
    ];
    // ~0m away — inside radius
    expect(isAtKnownIndoorLocation(51.5, 4.3, locations)).toBe(true);
  });

  it('ignores outdoor (non-indoor) locations', () => {
    const locations = [
      { id: 1, label: 'Park', latitude: 51.5, longitude: 4.3, radiusMeters: 100, isIndoor: false, status: 'active' as const },
    ];
    expect(isAtKnownIndoorLocation(51.5, 4.3, locations)).toBe(false);
  });
});

describe('processLocationUpdate', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetGPSStateForTesting();

    // Default: no known locations → always "outside"
    (Database.getKnownLocations as jest.Mock).mockReturnValue([]);
    // Default: no persisted GPS state, return '[]' for location_clusters
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_clusters') return '[]';
      return fallback;
    });
    (Database.setSetting as jest.Mock).mockImplementation(() => undefined);
    (SessionMerger.submitSession as jest.Mock).mockImplementation(() => undefined);
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (startTime: number, endTime: number, source: string, confidence: number, notes?: string) => ({
        startTime, endTime, durationMinutes: (endTime - startTime) / 60000,
        source, confidence, userConfirmed: null, notes,
      }),
    );
  });

  it('does not submit a session on the very first location update', () => {
    processLocationUpdate(51.5, 4.3, NOW);
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('does not submit a session when duration is below minimum threshold', () => {
    processLocationUpdate(51.5, 4.3, NOW);
    // Only 2 minutes later — below MIN_OUTSIDE_DURATION_MS
    processLocationUpdate(51.5001, 4.3001, NOW + 2 * 60 * 1000);
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('flushes a periodic session once MIN_OUTSIDE_DURATION_MS has elapsed (no indoor locations)', () => {
    processLocationUpdate(51.5, 4.3, NOW);
    // MIN_OUTSIDE_DURATION_MS later → should flush
    processLocationUpdate(51.5001, 4.3001, NOW + MIN_OUTSIDE_DURATION_MS);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(NOW);                               // startTime
    expect(call[1]).toBe(NOW + MIN_OUTSIDE_DURATION_MS);     // endTime
    expect(call[2]).toBe('gps');
  });

  it('resets the session start after a periodic flush', () => {
    processLocationUpdate(51.5, 4.3, NOW);
    const T1 = NOW + MIN_OUTSIDE_DURATION_MS;
    processLocationUpdate(51.5001, 4.3001, T1); // first flush

    jest.clearAllMocks();
    (Database.getKnownLocations as jest.Mock).mockReturnValue([]);
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'location_clusters') return '[]';
      return fallback;
    });
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (startTime: number, endTime: number, source: string, confidence: number, notes?: string) => ({
        startTime, endTime, durationMinutes: (endTime - startTime) / 60000,
        source, confidence, userConfirmed: null, notes,
      }),
    );

    // After reset, a further MIN_OUTSIDE_DURATION_MS elapsed → second flush
    const T2 = T1 + MIN_OUTSIDE_DURATION_MS;
    processLocationUpdate(51.5002, 4.3002, T2);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(T1); // new startTime is from after the previous flush
  });

  it('submits a session on indoor transition when known indoor location exists', () => {
    const homeLocation = {
      id: 1, label: 'Home',
      latitude: 51.5, longitude: 4.3,
      radiusMeters: 100, isIndoor: true, status: 'active' as const,
    };

    // First update: user is outside (far from home — ~1 km away)
    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.51, 4.31, NOW); // ~1km from home → outside, no start label

    // After MIN_OUTSIDE_DURATION_MS, user is back at home (indoor)
    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.5, 4.3, NOW + MIN_OUTSIDE_DURATION_MS);

    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[2]).toBe('gps');
    // Notes should describe return to Home (start location unknown because user was far away at start)
    const notes: string = call[4];
    expect(notes).toMatch(/GPS detection/i);
    expect(notes).toMatch(/Home/);
  });

  it('GPS notes include "left … and returned" when returning to same location', () => {
    const homeLocation = {
      id: 1, label: 'Home',
      latitude: 51.5, longitude: 4.3,
      radiusMeters: 100, isIndoor: true, status: 'active' as const,
    };

    // Start near Home (just left it)
    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.501, 4.301, NOW); // just left Home — nearby within 2×radius

    // Return to Home after minimum duration
    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.5, 4.3, NOW + MIN_OUTSIDE_DURATION_MS);

    expect(SessionMerger.buildSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    const notes: string = call[4];
    expect(notes).toMatch(/left Home and returned/i);
    expect(notes).toMatch(/km/);
  });

  it('GPS periodic notes include distance and speed info', () => {
    // Speed provided: 1.39 m/s ≈ 5 km/h
    processLocationUpdate(51.5, 4.3, NOW, 1.39);
    processLocationUpdate(51.5001, 4.3001, NOW + MIN_OUTSIDE_DURATION_MS, 1.39);

    expect(SessionMerger.buildSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    const notes: string = call[4];
    expect(notes).toMatch(/GPS detection/i);
    expect(notes).toMatch(/km at.*km\/h/i);
  });

  it('GPS notes omit location when no known locations exist', () => {
    // No known locations → always outside, no departure/arrival label
    processLocationUpdate(51.5, 4.3, NOW);
    processLocationUpdate(51.5001, 4.3001, NOW + MIN_OUTSIDE_DURATION_MS);

    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    const notes: string = call[4];
    expect(notes).toMatch(/GPS detection/i);
    // No specific location name should appear
    expect(notes).not.toMatch(/Home|Work/);
  });

  it('does not submit a session when coming inside after less than minimum duration', () => {
    const homeLocation = {
      id: 1, label: 'Home',
      latitude: 51.5, longitude: 4.3,
      radiusMeters: 100, isIndoor: true, status: 'active' as const,
    };

    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.51, 4.31, NOW); // outside

    // Only 2 minutes later — below minimum
    (Database.getKnownLocations as jest.Mock).mockReturnValue([homeLocation]);
    processLocationUpdate(51.5, 4.3, NOW + 2 * 60 * 1000); // back inside

    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('persists GPS state by calling setSetting after each update', () => {
    processLocationUpdate(51.5, 4.3, NOW);
    expect(Database.setSetting).toHaveBeenCalled();
  });

  it('restores persisted session start on first call after restart', () => {
    const savedStart = NOW - MIN_OUTSIDE_DURATION_MS;
    // Simulate persisted state: user was already outside before restart
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'gps_session_start') return String(savedStart);
      if (key === 'gps_last_outside') return '1';
      if (key === 'location_clusters') return '[]';
      return fallback;
    });

    // First update after restart — duration already >= MIN → should flush immediately
    processLocationUpdate(51.5001, 4.3001, NOW);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const call = (SessionMerger.buildSession as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(savedStart); // restored start time used
  });
});
