import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { PermissionService } from '../detection/PermissionService';

// Unmock the service that was globally mocked in jest.setup.js
jest.unmock('../detection/PermissionService');

// Mock expo-location
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 30,
  },
  PermissionsAndroid: {
    check: jest.fn(),
    request: jest.fn(),
    PERMISSIONS: {
      ACTIVITY_RECOGNITION: 'android.permission.ACTIVITY_RECOGNITION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
  },
}));

// Mock react-native-health-connect
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
}));

// Mock healthConnectIntent
jest.mock('../detection/healthConnectIntent', () => ({
  openHealthConnectPermissionsViaIntent: jest.fn(),
  verifyHealthConnectPermissions: jest.fn(),
}));

// Mock storage
jest.mock('../storage', () => ({
  setSettingAsync: jest.fn(),
}));

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to Android
    Platform.OS = 'android';
    Platform.Version = 30;
  });

  describe('requestLocationPermissions', () => {
    it('returns immediately if all permissions are already granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await PermissionService.requestLocationPermissions();

      expect(result.granted).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests foreground if not granted, then background if foreground succeeds', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await PermissionService.requestLocationPermissions();

      expect(result.granted).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    });

    it('stops if foreground request fails', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });

      const result = await PermissionService.requestLocationPermissions();

      expect(result.granted).toBe(false);
      expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('returns false if background request fails', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await PermissionService.requestLocationPermissions();

      expect(result.granted).toBe(false);
    });

    it('catches and logs errors', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Test error')
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await PermissionService.requestLocationPermissions();

      expect(result.granted).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Location permission request error'),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('requestWeatherLocationPermissions', () => {
    it('returns true immediately if foreground is already granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await PermissionService.requestWeatherLocationPermissions();

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests foreground if not granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await PermissionService.requestWeatherLocationPermissions();

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('Activity Recognition', () => {
    describe('checkActivityRecognitionPermissions', () => {
      it('returns true on non-Android platforms', async () => {
        jest.isolateModules(async () => {
          const { Platform } = require('react-native');
          Platform.OS = 'ios';
          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.checkActivityRecognitionPermissions();
          expect(result).toBe(true);
        });
      });

      it('returns true on Android < 10 (API < 29)', async () => {
        jest.isolateModules(async () => {
          const { Platform } = require('react-native');
          Platform.OS = 'android';
          Platform.Version = 28;
          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.checkActivityRecognitionPermissions();
          expect(result).toBe(true);
        });
      });

      it('checks permission on Android 10+', async () => {
        jest.isolateModules(async () => {
          const { Platform, PermissionsAndroid } = require('react-native');
          Platform.OS = 'android';
          Platform.Version = 29;
          (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.checkActivityRecognitionPermissions();

          expect(result).toBe(true);
          expect(PermissionsAndroid.check).toHaveBeenCalled();
        });
      });
    });

    describe('requestActivityRecognitionPermissions', () => {
      it('returns granted immediately if already granted', async () => {
        jest.isolateModules(async () => {
          const { Platform, PermissionsAndroid } = require('react-native');
          Platform.OS = 'android';
          Platform.Version = 30;
          (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.requestActivityRecognitionPermissions();

          expect(result.granted).toBe(true);
          expect(PermissionsAndroid.request).not.toHaveBeenCalled();
        });
      });

      it('requests permission if not granted', async () => {
        jest.isolateModules(async () => {
          const { Platform, PermissionsAndroid } = require('react-native');
          Platform.OS = 'android';
          Platform.Version = 30;
          (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
          (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
            PermissionsAndroid.RESULTS.GRANTED
          );

          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.requestActivityRecognitionPermissions();

          expect(result.granted).toBe(true);
          expect(PermissionsAndroid.request).toHaveBeenCalled();
        });
      });

      it('returns canAskAgain false if result is NEVER_ASK_AGAIN', async () => {
        jest.isolateModules(async () => {
          const { Platform, PermissionsAndroid } = require('react-native');
          Platform.OS = 'android';
          Platform.Version = 30;
          (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
          (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          );

          const { PermissionService } = require('../detection/PermissionService');
          const result = await PermissionService.requestActivityRecognitionPermissions();

          expect(result.granted).toBe(false);
          expect(result.canAskAgain).toBe(false);
        });
      });
    });
  });
});
