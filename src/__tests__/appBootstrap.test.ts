import { act } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { initDatabaseAsync, getSettingAsync, setSettingAsync } from '../storage';
import i18n, { getDeviceSupportedLocale } from '../i18n';
import {
  performCriticalInitializationAsync,
  performDeferredInitialization,
} from '../../appBootstrap';

// Mock dependencies
jest.mock('../storage', () => ({
  initDatabaseAsync: jest.fn(),
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    locale: 'en',
  },
  getDeviceSupportedLocale: jest.fn(() => 'en'),
  SUPPORTED_LOCALES: ['en', 'nl'],
}));

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback: () => void) => {
      callback();
      return { cancel: () => {} };
    }),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((specs) => specs.android ?? specs.default),
  },
  console: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
    manifest: { extra: {} },
  },
}));

// Mock all deferred tasks
jest.mock('expo-battery');
jest.mock('../utils/batteryOptimization');
jest.mock('../notifications/notificationManager', () => ({
  NotificationService: {
    setupNotificationInfrastructure: jest.fn(),
    scheduleDayReminders: jest.fn(),
    scheduleAllScheduledNotifications: jest.fn(),
  },
}));
jest.mock('../detection/index');
jest.mock('../background/unifiedBackgroundTask', () => ({
  BackgroundService: {
    registerUnifiedBackgroundTask: jest.fn(),
    scheduleNextAlarmPulse: jest.fn(),
  },
}));
jest.mock('../utils/widgetHelper');

import { refreshBatteryOptimizationSetting } from '../utils/batteryOptimization';
import { NotificationService } from '../notifications/notificationManager';
import { initDetection } from '../detection/index';
import { BackgroundService } from '../background/unifiedBackgroundTask';
import { requestWidgetRefresh } from '../utils/widgetHelper';

describe('services/appBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performCriticalInitializationAsync', () => {
    it('initializes db asynchronously and returns correct state', async () => {
      (initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);
      (getSettingAsync as jest.Mock).mockImplementation(async (key) => {
        if (key === 'hasCompletedIntro') return '1';
        if (key === 'language') return 'nl';
        return '';
      });

      const result = await performCriticalInitializationAsync();

      expect(initDatabaseAsync).toHaveBeenCalledTimes(1);
      expect(i18n.locale).toBe('nl');
      expect(result).toEqual({
        showIntro: false,
        initialLocale: 'nl',
      });
    });

    it('handles "system" language asynchronously', async () => {
      (initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);
      (getSettingAsync as jest.Mock).mockImplementation(async (key) => {
        if (key === 'hasCompletedIntro') return '0';
        if (key === 'language') return 'system';
        return '';
      });
      (getDeviceSupportedLocale as jest.Mock).mockReturnValue('nl');

      const result = await performCriticalInitializationAsync();

      expect(i18n.locale).toBe('nl');
      expect(result.initialLocale).toBe('system');
    });

    it('handles invalid language asynchronously', async () => {
      (initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);
      (getSettingAsync as jest.Mock).mockImplementation(async (key) => {
        if (key === 'hasCompletedIntro') return '1';
        if (key === 'language') return 'fr';
        return '';
      });
      (setSettingAsync as jest.Mock).mockResolvedValue(undefined);

      const result = await performCriticalInitializationAsync();

      expect(i18n.locale).toBe('en');
      expect(setSettingAsync).toHaveBeenCalledWith('language', 'en');
      expect(result.initialLocale).toBe('en');
    });
  });

  describe('performDeferredInitialization', () => {
    it('executes all deferred tasks after interactions', async () => {
      await act(async () => {
        performDeferredInitialization();
      });

      expect(InteractionManager.runAfterInteractions).toHaveBeenCalledTimes(1);
      expect(refreshBatteryOptimizationSetting).toHaveBeenCalledTimes(1);
      expect(NotificationService.setupNotificationInfrastructure).toHaveBeenCalledTimes(1);
      expect(initDetection).toHaveBeenCalledTimes(1);
      expect(NotificationService.scheduleDayReminders).toHaveBeenCalledTimes(1);
      expect(NotificationService.scheduleAllScheduledNotifications).toHaveBeenCalledTimes(1);
      expect(BackgroundService.registerUnifiedBackgroundTask).toHaveBeenCalledTimes(1);
      expect(BackgroundService.scheduleNextAlarmPulse).toHaveBeenCalledTimes(1);
      expect(requestWidgetRefresh).toHaveBeenCalledTimes(1);
    });

    it('continues execution even if a task fails', async () => {
      (initDetection as jest.Mock).mockRejectedValue(new Error('Detection failed'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await act(async () => {
        performDeferredInitialization();
      });

      expect(console.warn).toHaveBeenCalledWith(
        "TouchGrass: Deferred init task 'Detection Initialization' failed:",
        expect.any(Error)
      );
      expect(NotificationService.scheduleDayReminders).toHaveBeenCalledTimes(1); // A task after the failed one
      consoleWarnSpy.mockRestore();
    });
  });
});
