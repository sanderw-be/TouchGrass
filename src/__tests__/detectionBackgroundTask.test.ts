jest.mock('../storage/database');
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
  autoDetectLocations: jest.fn().mockResolvedValue(undefined),
}));

import * as Database from '../storage/database';
import * as Detection from '../detection/index';

describe('initDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getSetting as jest.Mock).mockImplementation((_key: string, fallback: string) => fallback);
    (Database.setSetting as jest.Mock).mockImplementation(() => {});
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

  it('does not register any WorkManager background task', async () => {
    // expo-background-task registerTaskAsync should never be called — the
    // TOUCHGRASS_BACKGROUND_TASK WorkManager registration was removed.
    const { registerTaskAsync } = require('expo-background-task');
    await Detection.initDetection();
    expect(registerTaskAsync).not.toHaveBeenCalled();
  });
});
