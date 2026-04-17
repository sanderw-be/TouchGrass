import { Platform } from 'react-native';
import {
  WIDGET_TIMER_KEY,
  requestWidgetRefresh,
  isWidgetTimerRunning,
} from '../utils/widgetHelper';

jest.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: jest.fn(() => Promise.resolve()),
}));

jest.mock('../storage/database', () => ({
  initDatabaseAsync: jest.fn(() => Promise.resolve()),
  getTodayMinutesAsync: jest.fn(() => Promise.resolve(15)),
  getCurrentDailyGoalAsync: jest.fn(() => Promise.resolve({ targetMinutes: 60 })),
  getSettingAsync: jest.fn(() => Promise.resolve('')),
}));

jest.mock('../widget/ProgressWidget', () => ({
  ProgressWidget: jest.fn(() => null),
}));

describe('widgetHelper', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('WIDGET_TIMER_KEY', () => {
    it('exports the expected settings key', () => {
      expect(WIDGET_TIMER_KEY).toBe('widget_timer_start');
    });
  });

  describe('requestWidgetRefresh', () => {
    it('is a no-op on non-Android platforms', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      await expect(requestWidgetRefresh()).resolves.toBeUndefined();

      const { requestWidgetUpdate } = require('react-native-android-widget');
      expect(requestWidgetUpdate).not.toHaveBeenCalled();
    });

    it('calls requestWidgetUpdate on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const { requestWidgetUpdate } = require('react-native-android-widget');

      await requestWidgetRefresh();

      expect(requestWidgetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          widgetName: 'Progress',
        })
      );
    });

    it('passes widget dimensions from widgetInfo to ProgressWidget', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { ProgressWidget } = require('../widget/ProgressWidget');

      await requestWidgetRefresh();

      const [[callArgs]] = requestWidgetUpdate.mock.calls;
      const widgetInfo = {
        widgetName: 'Progress',
        widgetId: 1,
        width: 320,
        height: 160,
        screenInfo: { screenHeightDp: 800, screenWidthDp: 400, density: 2, densityDpi: 320 },
      };
      callArgs.renderWidget(widgetInfo);

      expect(ProgressWidget).toHaveBeenCalledWith(
        expect.objectContaining({ widgetWidth: 320, widgetHeight: 160 })
      );
    });

    it('handles errors gracefully', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const { requestWidgetUpdate } = require('react-native-android-widget');
      requestWidgetUpdate.mockRejectedValueOnce(new Error('Native error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(requestWidgetRefresh()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Widget refresh failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('isWidgetTimerRunning', () => {
    it('returns false for empty string', () => {
      expect(isWidgetTimerRunning('')).toBe(false);
    });

    it('returns false for non-numeric string', () => {
      expect(isWidgetTimerRunning('abc')).toBe(false);
    });

    it('returns false for zero', () => {
      expect(isWidgetTimerRunning('0')).toBe(false);
    });

    it('returns true for valid timestamp', () => {
      expect(isWidgetTimerRunning('1712345678000')).toBe(true);
    });
  });
});
