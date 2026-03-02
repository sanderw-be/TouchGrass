jest.mock('../storage/database');
jest.mock('../detection/sessionMerger');
jest.mock('react-native-health-connect');

import * as HealthConnect from 'react-native-health-connect';
import * as Database from '../storage/database';
import * as SessionMerger from '../detection/sessionMerger';
import {
  syncHealthConnect,
  MIN_DURATION_MS,
  STEPS_PER_MINUTE_AT_5KMH,
  STEPS_PER_MIN_AT_2_5KMH,
  STEPS_PER_MIN_AT_4KMH,
  CONFIDENCE_ACTIVITY,
} from '../detection/healthConnect';

describe('syncHealthConnect', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();

    (HealthConnect.getSdkStatus as jest.Mock).mockResolvedValue(3); // SDK_AVAILABLE
    (HealthConnect.initialize as jest.Mock).mockResolvedValue(undefined);
    (Database.getSetting as jest.Mock).mockReturnValue('0');
    (Database.setSetting as jest.Mock).mockImplementation(() => undefined);
    (Database.pruneShortDiscardedHealthConnectSessions as jest.Mock).mockReturnValue(0);
    (Database.getKnownLocations as jest.Mock).mockReturnValue([]);
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (startTime, endTime, source, confidence, notes, steps) => ({
        startTime, endTime, durationMinutes: (endTime - startTime) / 60000,
        source, confidence, userConfirmed: null, notes, steps,
      }),
    );
    (SessionMerger.submitSession as jest.Mock).mockImplementation(() => undefined);
  });

  it('returns false when Health Connect is not available', async () => {
    (HealthConnect.getSdkStatus as jest.Mock).mockResolvedValue(1); // SDK_UNAVAILABLE
    const result = await syncHealthConnect();
    expect(result).toBe(false);
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('submits exercise sessions from Health Connect', async () => {
    const sessionStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }], // WALKING
        });
      }
      return Promise.resolve({ records: [] });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    expect(session.startTime).toBe(new Date(sessionStart).getTime());
  });

  it('skips exercise sessions shorter than minimum duration', async () => {
    const sessionStart = new Date(NOW - 2 * 60 * 1000).toISOString(); // only 2 min
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    await syncHealthConnect();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('submits steps records as sessions when step count and duration are sufficient', async () => {
    const stepsStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 3000 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    // Step count is stored in the `steps` field, not in notes
    expect(session.steps).toBe(3000);
    expect(session.notes).toBeUndefined();
  });

  it('submits steps records with walking speed below 2.5 km/h for later pruning (not skipped at ingestion)', async () => {
    // 100 steps in 2 minutes = 50 steps/min < STEPS_PER_MIN_AT_2_5KMH (55).
    // These tiny records must be submitted so adjacent records can merge in the
    // 5-minute window; the pruning phase drops them if they remain too slow once settled.
    const stepsStart = new Date(NOW - 2 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 100 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    await syncHealthConnect();
    // Record is submitted (not skipped) — it can still merge with adjacent records
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    expect(session.steps).toBe(100);
  });

  it('submits steps records with walking speed between 2.5–4 km/h with reduced confidence', async () => {
    // Steps/min between STEPS_PER_MIN_AT_2_5KMH (55) and STEPS_PER_MIN_AT_4KMH (88).
    // e.g. 420 steps in 6 minutes = 70 steps/min → slow walk
    const stepsStart = new Date(NOW - 6 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 420 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    await syncHealthConnect();
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    // Confidence must be less than CONFIDENCE_ACTIVITY
    expect(session.confidence).toBeLessThan(CONFIDENCE_ACTIVITY);
  });

  it('submits short steps records as sessions for aggregation', async () => {
    // 520 steps at 110 steps/min ≈ 4.7 min effective — above speed threshold
    // (stepsPerMinute ≈ 110) but still a short session for aggregation.
    const stepsStart = new Date(NOW - 2 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 520 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    await syncHealthConnect();
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    expect(session.steps).toBe(520);
  });

  it('uses step-based estimated duration when recorded duration is too short (batch sync)', async () => {
    // 3000 steps at 110 steps/min ≈ 27 min — well above MIN_DURATION_MS
    // Recorded window is only 1 second, simulating a batch-sync scenario.
    const stepsStart = new Date(NOW - 1000).toISOString(); // 1 second recorded
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 3000 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    const expectedDurationMs = (3000 / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
    // The recorded end time must be preserved; the start is pushed backwards.
    expect(session.endTime).toBe(NOW);
    expect(session.endTime - session.startTime).toBeCloseTo(expectedDurationMs, -2); // -2: nearest 100 ms
  });

  it('does not disable Health Connect when sync fails with a non-permission error', async () => {
    (HealthConnect.readRecords as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    const result = await syncHealthConnect();

    expect(result).toBe(false);
    // healthconnect_enabled should NOT have been set to '0' for a transient error
    const disableCalls = (Database.setSetting as jest.Mock).mock.calls.filter(
      ([key, value]: [string, string]) => key === 'healthconnect_enabled' && value === '0',
    );
    expect(disableCalls).toHaveLength(0);
  });

  it('disables Health Connect when a SecurityException (permission) error occurs', async () => {
    (HealthConnect.readRecords as jest.Mock).mockRejectedValue(
      new Error('SecurityException: Missing READ_EXERCISE permission'),
    );

    const result = await syncHealthConnect();

    expect(result).toBe(false);
    expect(Database.setSetting).toHaveBeenCalledWith('healthconnect_enabled', '0');
  });

  it('disables Health Connect when a SecurityException without READ_ in message occurs', async () => {
    (HealthConnect.readRecords as jest.Mock).mockRejectedValue(
      new Error(
        'SecurityException: android.health.connect.HealthConnectException: java.lang.SecurityException: Caller does not have permission to read data for the following (recordType: class android.health.connect.datatypes.ExerciseSessionRecord) from other applications.',
      ),
    );

    const result = await syncHealthConnect();

    expect(result).toBe(false);
    expect(Database.setSetting).toHaveBeenCalledWith('healthconnect_enabled', '0');
  });

  it('updates healthconnect_last_sync on success', async () => {
    (HealthConnect.readRecords as jest.Mock).mockResolvedValue({ records: [] });

    await syncHealthConnect();

    const lastSyncCall = (Database.setSetting as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === 'healthconnect_last_sync',
    );
    expect(lastSyncCall).toBeDefined();
  });

  it('prunes settled short/slow discarded sessions after a successful sync', async () => {
    (HealthConnect.readRecords as jest.Mock).mockResolvedValue({ records: [] });

    const before = Date.now();
    await syncHealthConnect();
    const after = Date.now();

    expect(Database.pruneShortDiscardedHealthConnectSessions).toHaveBeenCalledTimes(1);
    const [beforeMs, minStepsPerMinute] = (Database.pruneShortDiscardedHealthConnectSessions as jest.Mock).mock.calls[0];
    // cutoff must be now - MIN_DURATION_MS (5 min), within the test execution window
    expect(beforeMs).toBeGreaterThanOrEqual(before - 5 * 60 * 1000);
    expect(beforeMs).toBeLessThanOrEqual(after - 5 * 60 * 1000 + 100); // +100 ms: allow for JS execution time
    // speed threshold must be passed so the DB can prune too-slow settled sessions
    expect(minStepsPerMinute).toBe(STEPS_PER_MIN_AT_2_5KMH);
  });

  it('does not prune when sync fails', async () => {
    (HealthConnect.readRecords as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    await syncHealthConnect();

    expect(Database.pruneShortDiscardedHealthConnectSessions).not.toHaveBeenCalled();
  });

  it('skips steps records when GPS shows user was at a known indoor location throughout', async () => {
    const stepsStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 3000 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    // GPS samples all within the session window, all inside a known location
    const indoorLat = 51.0;
    const indoorLon = 4.0;
    const gpsSamples = [
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 25 * 60 * 1000 },
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 15 * 60 * 1000 },
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 5 * 60 * 1000 },
    ];
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'location_clusters') return JSON.stringify(gpsSamples);
      return '0';
    });
    (Database.getKnownLocations as jest.Mock).mockReturnValue([
      { id: 1, label: 'home', latitude: indoorLat, longitude: indoorLon, radiusMeters: 100, isIndoor: true, status: 'active' },
    ]);

    await syncHealthConnect();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('does not skip steps records when GPS samples are outside the known location', async () => {
    const stepsStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 3000 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    // GPS sample is far from the known indoor location
    const gpsSamples = [
      { lat: 52.0, lon: 5.0, timestamp: NOW - 15 * 60 * 1000 },
    ];
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'location_clusters') return JSON.stringify(gpsSamples);
      return '0';
    });
    (Database.getKnownLocations as jest.Mock).mockReturnValue([
      { id: 1, label: 'home', latitude: 51.0, longitude: 4.0, radiusMeters: 100, isIndoor: true, status: 'active' },
    ]);

    await syncHealthConnect();
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
  });

  it('skips exercise sessions when GPS shows user was at a known indoor location throughout', async () => {
    const sessionStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }],
        });
      }
      return Promise.resolve({ records: [] });
    });

    const indoorLat = 51.0;
    const indoorLon = 4.0;
    const gpsSamples = [
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 25 * 60 * 1000 },
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 10 * 60 * 1000 },
    ];
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'location_clusters') return JSON.stringify(gpsSamples);
      return '0';
    });
    (Database.getKnownLocations as jest.Mock).mockReturnValue([
      { id: 1, label: 'home', latitude: indoorLat, longitude: indoorLon, radiusMeters: 100, isIndoor: true, status: 'active' },
    ]);

    await syncHealthConnect();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });
});
