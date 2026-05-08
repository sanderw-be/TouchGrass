import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Migration180Screen from '../screens/Migration180Screen';
import { setSettingAsync } from '../storage';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';

// Mock the i18n module
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Mock IntentLauncher
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}));

// Mock React Native Alert
jest.spyOn(Alert, 'alert');

// Mock detection and module
const mockToggleAR = jest.fn((enabled?: boolean) => Promise.resolve({ needsPermissions: false }));
jest.mock('../detection/index', () => ({
  toggleAR: (enabled: boolean) => mockToggleAR(enabled),
}));

jest.mock('../modules/ActivityTransitionModule', () => ({
  ActivityTransitionModule: {
    startTracking: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../detection/PermissionService', () => ({
  PermissionService: {
    requestActivityRecognitionPermissions: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true })
    ),
    checkActivityRecognitionPermissions: jest.fn(() => Promise.resolve(false)),
  },
}));

const mockSetSettingAsync = jest.fn((key: string, value: string) => Promise.resolve());
jest.mock('../storage', () => ({
  setSettingAsync: (key: string, value: string) => mockSetSettingAsync(key, value),
}));

describe('Migration180Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToggleAR.mockResolvedValue({ needsPermissions: false });
  });

  it('renders correctly', () => {
    const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);
    expect(getByText('migration_180_title')).toBeTruthy();
  });

  it('handles Complete button click', async () => {
    const onCompleteMock = jest.fn();
    const { getByText } = render(<Migration180Screen onComplete={onCompleteMock} />);

    // Default mock returns checkActivityRecognitionPermissions = true
    await waitFor(() => {
      fireEvent.press(getByText('migration_180_continue_button'));
    });

    expect(mockSetSettingAsync).toHaveBeenCalledWith('ar_enabled', '1');
    expect(onCompleteMock).toHaveBeenCalled();
  });

  describe('Activity Recognition', () => {
    let originalPlatformOS: typeof Platform.OS;

    beforeAll(() => {
      originalPlatformOS = Platform.OS;
      Platform.OS = 'android';
    });

    afterAll(() => {
      Platform.OS = originalPlatformOS;
    });

    beforeEach(() => {
      const { PermissionService } = require('../detection/PermissionService');
      (PermissionService.checkActivityRecognitionPermissions as jest.Mock).mockResolvedValue(false);
    });

    it('requests AR when button is clicked', async () => {
      const { PermissionService } = require('../detection/PermissionService');
      mockToggleAR.mockResolvedValueOnce({ needsPermissions: true });
      const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);

      await waitFor(() => {
        expect(getByText('intro_ar_button')).toBeTruthy();
      });

      fireEvent.press(getByText('intro_ar_button'));

      await waitFor(() => {
        expect(mockToggleAR).toHaveBeenCalledWith(true);
        expect(PermissionService.requestActivityRecognitionPermissions).toHaveBeenCalled();
      });
    });

    it('handles AR toggle returning false needsPermissions', async () => {
      const { PermissionService } = require('../detection/PermissionService');
      mockToggleAR.mockResolvedValueOnce({ needsPermissions: false });
      const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);

      await waitFor(() => {
        expect(getByText('intro_ar_button')).toBeTruthy();
      });

      fireEvent.press(getByText('intro_ar_button'));

      await waitFor(() => {
        expect(mockToggleAR).toHaveBeenCalledWith(true);
        expect(PermissionService.requestActivityRecognitionPermissions).not.toHaveBeenCalled();
      });
    });

    it('handles toggle errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockToggleAR.mockRejectedValueOnce(new Error('Toggle Failed'));

      const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);

      await waitFor(() => {
        expect(getByText('intro_ar_button')).toBeTruthy();
      });

      fireEvent.press(getByText('intro_ar_button'));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Battery Settings (Android)', () => {
    let originalPlatformOS: typeof Platform.OS;

    beforeAll(() => {
      originalPlatformOS = Platform.OS;
      Platform.OS = 'android';
    });

    afterAll(() => {
      Platform.OS = originalPlatformOS;
    });

    it('opens battery settings when button is pressed', async () => {
      const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);

      fireEvent.press(getByText('migration_180_battery_button'));

      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
      );
    });

    it('shows an alert if IntentLauncher fails', async () => {
      (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Intent Failed')
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { getByText } = render(<Migration180Screen onComplete={jest.fn()} />);

      fireEvent.press(getByText('migration_180_battery_button'));

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          'settings_error_title',
          'settings_error_open_settings_failed'
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
