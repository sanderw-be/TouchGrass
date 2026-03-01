jest.mock('../storage/database');
jest.mock('../detection/sessionMerger');
jest.mock('react-native-health-connect');

import * as HealthConnect from 'react-native-health-connect';
import * as Database from '../storage/database';
import * as SessionMerger from '../detection/sessionMerger';
import { syncHealthConnect, MIN_DURATION_MS, STEPS_PER_MINUTE_AT_5KMH } from '../detection/healthConnect';

describe('syncHealthConnect', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();

    (HealthConnect.getSdkStatus as jest.Mock).mockResolvedValue(3); // SDK_AVAILABLE
    (HealthConnect.initialize as jest.Mock).mockResolvedValue(undefined);
    (Database.getSetting as jest.Mock).mockReturnValue('0');
    (Database.setSetting as jest.Mock).mockImplementation(() => undefined);
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (startTime, endTime, source, confidence, notes) => ({
        startTime, endTime, durationMinutes: (endTime - startTime) / 60000,
        source, confidence, userConfirmed: null, notes,
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
    expect(session.notes).toContain('Steps:');
  });

  it('skips steps records with too few steps', async () => {
    const stepsStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 100 }], // too few
        });
      }
      return Promise.resolve({ records: [] });
    });

    await syncHealthConnect();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('skips steps records shorter than minimum duration when step count is also insufficient for estimation', async () => {
    // 520 steps at 110 steps/min ≈ 4.7 min estimated — still below MIN_DURATION_MS
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
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
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
    // endTime should reflect the step-based estimate, not the recorded 1-second window
    const expectedDurationMs = (3000 / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
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
});
