jest.mock('../storage');
jest.mock('./healthConnect', () => ({}), { virtual: true });
jest.mock('../detection/healthConnect', () => ({
  syncHealthConnect: jest.fn().mockResolvedValue(true),
  isHealthConnectAvailable: jest.fn().mockResolvedValue(false),
  requestHealthPermissions: jest.fn().mockResolvedValue(false),
  openHealthConnectForManagement: jest.fn().mockResolvedValue(false),
}));
jest.mock('../detection/healthConnectIntent', () => ({
  verifyHealthConnectPermissions: jest.fn().mockResolvedValue(false),
}));
jest.mock('../detection/gpsDetection', () => ({
  startLocationTracking: jest.fn().mockResolvedValue(undefined),
  stopLocationTracking: jest.fn().mockResolvedValue(undefined),
  autoDetectLocations: jest.fn().mockResolvedValue(undefined),
}));

import * as Database from '../storage';
import * as HealthConnect from '../detection/healthConnect';
import * as HealthConnectIntent from '../detection/healthConnectIntent';
import * as GpsDetection from '../detection/gpsDetection';
import * as Detection from '../detection/index';

describe('initDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getSettingAsync as jest.Mock).mockImplementation((_key: string, fallback: string) =>
      Promise.resolve(fallback)
    );
    (Database.setSettingAsync as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  it('returns a DetectionStatus with defaults when no settings are stored', async () => {
    const status = await Detection.initDetection();

    expect(status).toMatchObject({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });
  });

  it('uses fast permission check (not data read) when HC is available and enabled', async () => {
    (HealthConnect.isHealthConnectAvailable as jest.Mock).mockResolvedValue(true);
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(true);
    // Simulate HC user toggle being on
    (Database.getSettingAsync as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'healthconnect_enabled') return Promise.resolve('1');
      if (key === 'healthconnect_enabled') return Promise.resolve('1');
      return Promise.resolve(fallback);
    });

    const status = await Detection.initDetection();

    expect(HealthConnectIntent.verifyHealthConnectPermissions).toHaveBeenCalled();
    expect(status.healthConnectPermission).toBe(true);
  });

  it('does not block on syncHealthConnect during initDetection', async () => {
    (HealthConnect.isHealthConnectAvailable as jest.Mock).mockResolvedValue(true);
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(true);
    // Simulate a slow sync that would delay startup if awaited
    let syncResolved = false;
    (HealthConnect.syncHealthConnect as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            syncResolved = true;
            resolve(true);
          }, 100)
        )
    );
    (Database.getSettingAsync as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'healthconnect_enabled') return Promise.resolve('1');
      if (key === 'healthconnect_enabled') return Promise.resolve('1');
      return Promise.resolve(fallback);
    });

    await Detection.initDetection();

    // Sync should have been kicked off but not yet resolved (fire-and-forget)
    expect(syncResolved).toBe(false);
    expect(HealthConnect.syncHealthConnect).toHaveBeenCalled();

    // Let the background promise settle to avoid leaking into other tests.
    await new Promise((r) => setTimeout(r, 150));
    expect(syncResolved).toBe(true);
  });

  it('does not auto-disable healthconnect_enabled when permissions are not granted', async () => {
    (HealthConnect.isHealthConnectAvailable as jest.Mock).mockResolvedValue(true);
    (HealthConnectIntent.verifyHealthConnectPermissions as jest.Mock).mockResolvedValue(false);
    (Database.getSettingAsync as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'healthconnect_enabled') return Promise.resolve('1');
      return Promise.resolve(fallback);
    });

    const status = await Detection.initDetection();

    expect(Database.setSettingAsync).not.toHaveBeenCalledWith('healthconnect_enabled', '0');
    expect(status.healthConnectPermission).toBe(false);
    expect(HealthConnect.syncHealthConnect).not.toHaveBeenCalled();
  });
});

describe('toggleGPS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getSettingAsync as jest.Mock).mockImplementation((_key: string, fallback: string) =>
      Promise.resolve(fallback)
    );
    (Database.setSettingAsync as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  it('calls stopLocationTracking when GPS is disabled', async () => {
    await Detection.toggleGPS(false);
    expect(GpsDetection.stopLocationTracking).toHaveBeenCalled();
  });

  it('sets gps_user_enabled and gps_enabled to 0 when GPS is disabled', async () => {
    await Detection.toggleGPS(false);
    expect(Database.setSettingAsync).toHaveBeenCalledWith('gps_enabled', '0');
    expect(Database.setSettingAsync).toHaveBeenCalledWith('gps_enabled', '0');
  });
});
