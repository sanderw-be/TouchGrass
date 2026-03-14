jest.mock('react-native-health-connect');
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 34 },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

import { Platform, Linking } from 'react-native';
import * as HealthConnect from 'react-native-health-connect';
import { openHealthConnectPermissionsViaIntent } from '../detection/healthConnectIntent';

describe('openHealthConnectPermissionsViaIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (Platform as any).Version = 34;
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    (HealthConnect.openHealthConnectSettings as jest.Mock).mockReturnValue(undefined);
  });

  it('returns false on non-Android platforms', async () => {
    (Platform as any).OS = 'ios';

    const result = await openHealthConnectPermissionsViaIntent();

    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(HealthConnect.openHealthConnectSettings).not.toHaveBeenCalled();
  });

  describe('Android 14+ (API 34+)', () => {
    beforeEach(() => {
      (Platform as any).Version = 34;
    });

    it('opens TouchGrass-specific permissions page via MANAGE_HEALTH_PERMISSIONS intent URI', async () => {
      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS'),
      );
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('com.jollyheron.touchgrass'),
      );
      expect(HealthConnect.openHealthConnectSettings).not.toHaveBeenCalled();
    });

    it('does not call canOpenURL before openURL for intent: URIs on Android 14+', async () => {
      await openHealthConnectPermissionsViaIntent();

      expect(Linking.canOpenURL).not.toHaveBeenCalled();
    });

    it('falls back to openHealthConnectSettings when MANAGE_HEALTH_PERMISSIONS fails', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('ActivityNotFoundException'));

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(true);
      expect(HealthConnect.openHealthConnectSettings).toHaveBeenCalled();
    });

    it('returns false when both Android 14+ methods fail', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));
      (HealthConnect.openHealthConnectSettings as jest.Mock).mockImplementation(() => {
        throw new Error('Failed');
      });

      const result = await openHealthConnectPermissionsViaIntent();

      expect(result).toBe(false);
    });

    it('does not open the Play Store on Android 14+', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));
      (HealthConnect.openHealthConnectSettings as jest.Mock).mockImplementation(() => {
        throw new Error('Failed');
      });

      await openHealthConnectPermissionsViaIntent();

      const playStoreCalls = (Linking.openURL as jest.Mock).mock.calls.filter(([url]: [string]) =>
        /^https?:\/\/play\.google\.com\//.test(url) || url.startsWith('market://'),
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
      expect(HealthConnect.openHealthConnectSettings).not.toHaveBeenCalled();
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
      expect(HealthConnect.openHealthConnectSettings).not.toHaveBeenCalled();
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

    it('does not call native library functions on Android 13', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

      await openHealthConnectPermissionsViaIntent();

      expect(HealthConnect.openHealthConnectSettings).not.toHaveBeenCalled();
    });
  });
});
