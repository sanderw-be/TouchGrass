jest.mock('../storage');
jest.mock('../detection/sessionMerger');
jest.mock('react-native-health-connect');
jest.mock('../detection/healthConnectIntent');
jest.mock('../detection/PermissionService');

import * as HealthConnect from 'react-native-health-connect';
import * as Database from '../storage';
import * as SessionMerger from '../detection/sessionMerger';
import * as HealthConnectIntent from '../detection/healthConnectIntent';
import { PermissionService } from '../detection/PermissionService';
import { syncHealthConnect, requestHealthPermissions } from '../detection/healthConnect';
import {
  STEPS_PER_MINUTE_AT_5KMH,
  STEPS_PER_MIN_AT_2_5KMH,
  CONFIDENCE_SLOW_WALK,
} from '../detection/constants';

describe('syncHealthConnect', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();

    (HealthConnect.getSdkStatus as jest.Mock).mockResolvedValue(3); // SDK_AVAILABLE
    (HealthConnect.initialize as jest.Mock).mockResolvedValue(undefined);
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'healthconnect_enabled') return '1';
      return '0';
    });
    (Database.setSettingAsync as jest.Mock).mockImplementation(async () => undefined);
    (Database.pruneShortDiscardedHealthConnectSessionsAsync as jest.Mock).mockResolvedValue(0);
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([]);
    (SessionMerger.buildSession as jest.Mock).mockImplementation(
      (startTime, endTime, source, confidence, notes, steps) => ({
        startTime,
        endTime,
        durationMinutes: (endTime - startTime) / 60000,
        source,
        confidence,
        userConfirmed: null,
        notes,
        steps,
      })
    );
    (SessionMerger.submitSession as jest.Mock).mockImplementation(async () => undefined);
    (HealthConnect.readRecords as jest.Mock).mockResolvedValue({
      records: [],
      pageToken: undefined,
    });
  });

  it('returns false and does not sync when HC is disabled by the user', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'healthconnect_enabled') return '0';
      return '0';
    });
    const result = await syncHealthConnect();
    expect(result).toBe(false);
    expect(HealthConnect.initialize).not.toHaveBeenCalled();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });

  it('returns false without syncing when within 10-minute cooldown', async () => {
    const recentSync = String(Date.now() - 5 * 60 * 1000); // 5 min ago — within cooldown
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'healthconnect_enabled') return '1';
      if (key === 'healthconnect_last_sync') return recentSync;
      return '0';
    });
    const result = await syncHealthConnect();
    expect(result).toBe(false);
    expect(HealthConnect.initialize).not.toHaveBeenCalled();
  });

  it('proceeds with sync when 10-minute cooldown has elapsed', async () => {
    const oldSync = String(Date.now() - 11 * 60 * 1000); // 11 min ago — past cooldown
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'healthconnect_enabled') return '1';
      if (key === 'healthconnect_last_sync') return oldSync;
      return '0';
    });
    const result = await syncHealthConnect();
    expect(result).toBe(true);
    expect(HealthConnect.initialize).toHaveBeenCalled();
  });

  it('submits exercise sessions from Health Connect', async () => {
    const sessionStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }], // WALKING
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    expect(session.startTime).toBe(new Date(sessionStart).getTime());
    expect(session.notes).toMatch(/Health Connect/i);
  });

  it('skips exercise sessions shorter than minimum duration', async () => {
    const sessionStart = new Date(NOW - 2 * 60 * 1000).toISOString(); // only 2 min
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }],
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
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
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.source).toBe('health_connect');
    expect(session.steps).toBe(3000);
    expect(session.notes).toMatch(/Health Connect,.*steps.*(?:km\/h|mph)/);
  });

  it('submits steps records with walking speed below 4 km/h with reduced confidence', async () => {
    // 420 steps in 6 minutes = 70 steps/min → slow walk
    const stepsStart = new Date(NOW - 6 * 60 * 1000).toISOString();
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 420 }],
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    await syncHealthConnect();
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    expect(session.confidence).toBe(CONFIDENCE_SLOW_WALK);
  });

  it('uses step-based estimated duration when recorded duration is too short', async () => {
    const stepsStart = new Date(NOW - 1000).toISOString(); // 1 second recorded
    const stepsEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') {
        return Promise.resolve({
          records: [{ startTime: stepsStart, endTime: stepsEnd, count: 3000 }],
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    const result = await syncHealthConnect();

    expect(result).toBe(true);
    expect(SessionMerger.submitSession).toHaveBeenCalledTimes(1);
    const session = (SessionMerger.submitSession as jest.Mock).mock.calls[0][0];
    const expectedDurationMs = (3000 / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
    expect(session.endTime).toBe(NOW);
    expect(session.endTime - session.startTime).toBeCloseTo(expectedDurationMs, -2);
  });

  it('disables Health Connect when a SecurityException error occurs', async () => {
    (HealthConnect.readRecords as jest.Mock).mockRejectedValue(
      new Error('SecurityException: Missing READ_EXERCISE permission')
    );

    const result = await syncHealthConnect();

    expect(result).toBe(false);
    expect(Database.setSettingAsync).toHaveBeenCalledWith('healthconnect_enabled', '0');
  });

  it('prunes settled short/slow discarded sessions after a successful sync', async () => {
    await syncHealthConnect();

    expect(Database.pruneShortDiscardedHealthConnectSessionsAsync).toHaveBeenCalledTimes(1);
    const [, minStepsPerMinute] = (
      Database.pruneShortDiscardedHealthConnectSessionsAsync as jest.Mock
    ).mock.calls[0];
    expect(minStepsPerMinute).toBe(STEPS_PER_MIN_AT_2_5KMH);
  });

  it('writes a single merged log entry with step and exercise counts', async () => {
    const sessionStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }],
          pageToken: undefined,
        });
      }
      if (type === 'Steps') {
        return Promise.resolve({
          records: [
            { startTime: sessionStart, endTime: sessionEnd, count: 3000 },
            { startTime: sessionStart, endTime: sessionEnd, count: 2000 },
          ],
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    await syncHealthConnect();

    const logCall = (Database.insertBackgroundLogAsync as jest.Mock).mock.calls.find(
      ([cat]: [string]) => cat === 'health_connect'
    );
    expect(logCall).toBeDefined();
    const [, message] = logCall as [string, string];
    expect(message).toMatch(/2 step record/);
    expect(message).toMatch(/1 exercise record/);
  });

  it('skips exercise sessions when GPS shows user was at a known indoor location throughout', async () => {
    const sessionStart = new Date(NOW - 30 * 60 * 1000).toISOString();
    const sessionEnd = new Date(NOW).toISOString();

    (HealthConnect.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'ExerciseSession') {
        return Promise.resolve({
          records: [{ startTime: sessionStart, endTime: sessionEnd, exerciseType: 79 }],
          pageToken: undefined,
        });
      }
      return Promise.resolve({ records: [], pageToken: undefined });
    });

    const indoorLat = 51.0;
    const indoorLon = 4.0;
    const gpsSamples = [
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 25 * 60 * 1000 },
      { lat: indoorLat, lon: indoorLon, timestamp: NOW - 10 * 60 * 1000 },
    ];
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'healthconnect_enabled') return '1';
      if (key === 'location_clusters') return JSON.stringify(gpsSamples);
      return '0';
    });
    (Database.getKnownLocationsAsync as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: 'home',
        latitude: indoorLat,
        longitude: indoorLon,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
    ]);

    await syncHealthConnect();
    expect(SessionMerger.submitSession).not.toHaveBeenCalled();
  });
});

describe('requestHealthPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HealthConnect.getSdkStatus as jest.Mock).mockResolvedValue(3); // SDK_AVAILABLE
    (HealthConnect.initialize as jest.Mock).mockResolvedValue(undefined);
    (Database.setSettingAsync as jest.Mock).mockImplementation(async () => undefined);
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('0');
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(false);
    (HealthConnectIntent.openHealthConnectPermissionsViaIntent as jest.Mock).mockResolvedValue(
      true
    );
    (PermissionService.requestHealthPermissions as jest.Mock).mockImplementation(async () => {
      const alreadyGranted = await HealthConnectIntent.verifyHealthConnectPermissions();
      if (alreadyGranted) return true;

      try {
        const granted = await HealthConnect.requestPermission([]);
        if (granted && granted.length > 0) return true;
      } catch {}

      return await HealthConnectIntent.openHealthConnectPermissionsViaIntent();
    });
  });

  it('returns true immediately when permissions are already granted', async () => {
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(true);

    const result = await requestHealthPermissions();

    expect(result).toBe(true);
    expect(HealthConnect.requestPermission).not.toHaveBeenCalled();
  });

  it('returns true when requestPermission grants permissions', async () => {
    (HealthConnect.requestPermission as jest.Mock).mockResolvedValue([
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    const result = await requestHealthPermissions();

    expect(result).toBe(true);
  });

  it('falls back to Intent when requestPermission returns empty', async () => {
    (HealthConnect.requestPermission as jest.Mock).mockResolvedValue([]);
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(false);

    const result = await requestHealthPermissions();

    expect(result).toBe(true);
    expect(HealthConnectIntent.openHealthConnectPermissionsViaIntent).toHaveBeenCalled();
  });
});
