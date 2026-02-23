jest.mock('react-native-health-connect');
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 34 },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

import { Platform, Linking } from 'react-native';
import { openHealthConnectPermissionsViaIntent } from '../detection/healthConnectIntent';

describe('openHealthConnectPermissionsViaIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (Platform as any).Version = 34;
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
  });

  it('returns false on non-Android platforms', async () => {
    (Platform as any).OS = 'ios';

    const result = await openHealthConnectPermissionsViaIntent();

    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  describe('Android 14+ (API 34+)', () => {
    beforeEach(() => {
      (Platform as any).Version = 34;
    });

    it('opens app-specific Health Connect permissions page via MANAGE_HEALTH_PERMISSIONS', async () => {
      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS'),
      );
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('com.sanderwubben.touchgrass'),
      );
    });

    it('falls back to HEALTH_HOME_SETTINGS when MANAGE_HEALTH_PERMISSIONS fails', async () => {
      (Linking.openURL as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledTimes(2);
      expect(Linking.openURL).toHaveBeenLastCalledWith(
        expect.stringContaining('android.health.connect.action.HEALTH_HOME_SETTINGS'),
      );
    });

    it('returns false when both Android 14+ methods fail', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(false);
    });

    it('does not open the Play Store on Android 14+', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));

      await openHealthConnectPermissionsViaIntent();

      const playStoreCalls = (Linking.openURL as jest.Mock).mock.calls.filter(([url]: [string]) =>
        url.includes('play.google.com') || url.includes('market://'),
      );
      expect(playStoreCalls).toHaveLength(0);
    });

    it('also works when Version is a string (API 34)', async () => {
      (Platform as any).Version = '34';

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS'),
      );
    });

    it('falls back to Android 13- path when Version string cannot be parsed', async () => {
      (Platform as any).Version = 'invalid';
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

      await openHealthConnectPermissionsViaIntent();

      // apiLevel would be 0 (NaN || 0), so it should use the Android 13- path
      expect(Linking.openURL).toHaveBeenCalledWith('healthconnect://');
    });
  });

  describe('Android 13 and below (API 33)', () => {
    beforeEach(() => {
      (Platform as any).Version = 33;
    });

    it('opens Health Connect via custom scheme when available', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith('healthconnect://');
    });

    it('falls back to Play Store market URL when custom scheme is unavailable', async () => {
      (Linking.canOpenURL as jest.Mock)
        .mockResolvedValueOnce(false)  // healthconnect://
        .mockResolvedValueOnce(true);  // market://

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('market://details?id=com.google.android.apps.healthdata'),
      );
    });

    it('falls back to browser Play Store URL as last resort', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
      );
    });

    it('returns false when all Android 13- methods fail', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(false);
    });

    it('does not use Android 14+ intents on Android 13', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

      await openHealthConnectPermissionsViaIntent();

      const newIntentCalls = (Linking.openURL as jest.Mock).mock.calls.filter(([url]: [string]) =>
        url.includes('android.health.connect.action'),
      );
      expect(newIntentCalls).toHaveLength(0);
    });
  });
});
