import { act } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { getSetting, initDatabase, setSetting } from '../storage/database';
import i18n, { getDeviceSupportedLocale } from '../i18n';
import { performCriticalInitialization, performDeferredInitialization } from '../../appBootstrap';

// Mock dependencies
jest.mock('../storage/database', () => ({
  initDatabase: jest.fn(),
  getSetting: jest.fn(),
  setSetting: jest.fn(),
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
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    // This mock was insufficient. Add a manifest object to satisfy dependencies.
    expoConfig: { extra: {} },
    manifest: { extra: {} },
  },
}));

// Mock all deferred tasks
jest.mock('expo-battery');
jest.mock('../utils/batteryOptimization');
jest.mock('../notifications/notificationManager');
jest.mock('../detection/index');
jest.mock('../notifications/scheduledNotifications');
jest.mock('../background/unifiedBackgroundTask');
jest.mock('../background/alarmTiming');
jest.mock('../utils/widgetHelper');

import { refreshBatteryOptimizationSetting } from '../utils/batteryOptimization';
import {
  setupNotificationInfrastructure,
  scheduleDayReminders,
} from '../notifications/notificationManager';
import { initDetection } from '../detection/index';
import { registerUnifiedBackgroundTask } from '../background/unifiedBackgroundTask';
import { scheduleNextAlarmPulse } from '../background/alarmTiming';
import { requestWidgetRefresh } from '../utils/widgetHelper';

describe('services/appBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performCriticalInitialization', () => {
    it('initializes db and returns correct state for a returning user', () => {
      (getSetting as jest.Mock).mockImplementation((key) => {
        if (key === 'hasCompletedIntro') return '1';
        if (key === 'language') return 'system';
        return '';
      });
      (getDeviceSupportedLocale as jest.Mock).mockReturnValue('nl');

      const result = performCriticalInitialization();

      expect(initDatabase).toHaveBeenCalledTimes(1);
      expect(getSetting).toHaveBeenCalledWith('language', 'system');
      expect(getSetting).toHaveBeenCalledWith('hasCompletedIntro', '0');
      expect(i18n.locale).toBe('nl');
      expect(result).toEqual({
        showIntro: false,
        initialLocale: 'system',
      });
      expect(setSetting).not.toHaveBeenCalled();
    });

    it('returns correct state for a new user', () => {
      (getSetting as jest.Mock).mockImplementation((key) => {
        if (key === 'hasCompletedIntro') return '0';
        if (key === 'language') return 'en';
        return '';
      });

      const result = performCriticalInitialization();

      expect(initDatabase).toHaveBeenCalledTimes(1);
      expect(i18n.locale).toBe('en');
      expect(result).toEqual({
        showIntro: true,
        initialLocale: 'en',
      });
    });

    it('handles an invalid stored language by defaulting to "en"', () => {
      (getSetting as jest.Mock).mockImplementation((key) => {
        if (key === 'language') return 'fr'; // Not in SUPPORTED_LOCALES
        return '1';
      });

      const result = performCriticalInitialization();

      expect(i18n.locale).toBe('en');
      expect(result.initialLocale).toBe('en');
      expect(setSetting).toHaveBeenCalledWith('language', 'en');
    });
  });

  describe('performDeferredInitialization', () => {
    it('executes all deferred tasks after interactions', async () => {
      await act(async () => {
        performDeferredInitialization();
      });

      expect(InteractionManager.runAfterInteractions).toHaveBeenCalledTimes(1);
      expect(refreshBatteryOptimizationSetting).toHaveBeenCalledTimes(1);
      expect(setupNotificationInfrastructure).toHaveBeenCalledTimes(1);
      expect(initDetection).toHaveBeenCalledTimes(1);
      expect(scheduleDayReminders).toHaveBeenCalledTimes(1);
      expect(registerUnifiedBackgroundTask).toHaveBeenCalledTimes(1);
      expect(scheduleNextAlarmPulse).toHaveBeenCalledTimes(1);
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
      expect(scheduleDayReminders).toHaveBeenCalledTimes(1); // A task after the failed one
      consoleWarnSpy.mockRestore();
    });
  });
});
