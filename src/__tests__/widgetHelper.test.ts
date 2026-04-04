import { Platform, Linking } from 'react-native';
import * as widgetHelper from '../utils/widgetHelper';

jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
jest.spyOn(Linking, 'addEventListener').mockReturnValue({ remove: jest.fn() } as any);

describe('widgetHelper', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('wasOpenedFromWidgetTimer', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('returns false on non-Android platforms', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      const result = await widgetHelper.wasOpenedFromWidgetTimer();
      expect(result).toBe(false);
    });

    it('returns true when URL contains startTimer=true', async () => {
      (Linking.getInitialURL as jest.Mock).mockResolvedValue('touchgrass://widget?startTimer=true');

      const result = await widgetHelper.wasOpenedFromWidgetTimer();
      expect(result).toBe(true);
    });

    it('returns false when URL does not contain startTimer', async () => {
      (Linking.getInitialURL as jest.Mock).mockResolvedValue('touchgrass://open');

      const result = await widgetHelper.wasOpenedFromWidgetTimer();
      expect(result).toBe(false);
    });

    it('returns false when URL is null', async () => {
      (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);

      const result = await widgetHelper.wasOpenedFromWidgetTimer();
      expect(result).toBe(false);
    });

    it('handles errors gracefully', async () => {
      (Linking.getInitialURL as jest.Mock).mockRejectedValue(new Error('Failed to get URL'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await widgetHelper.wasOpenedFromWidgetTimer();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error checking widget intent:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('addWidgetTimerListener', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('returns no-op cleanup on non-Android platforms', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      const callback = jest.fn();
      const cleanup = widgetHelper.addWidgetTimerListener(callback);

      cleanup();
      expect(callback).not.toHaveBeenCalled();
    });

    it('adds listener that triggers callback on widget URL', () => {
      const mockRemove = jest.fn();
      const mockSubscription = { remove: mockRemove };

      (Linking.addEventListener as jest.Mock).mockReturnValue(mockSubscription);

      const callback = jest.fn();
      const cleanup = widgetHelper.addWidgetTimerListener(callback);

      // Get the handler that was passed to addEventListener
      const handler = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

      // Simulate widget timer URL
      handler({ url: 'touchgrass://widget?startTimer=true' });
      expect(callback).toHaveBeenCalledTimes(1);

      // Simulate non-widget URL — should not trigger callback again
      handler({ url: 'touchgrass://open?other=param' });
      expect(callback).toHaveBeenCalledTimes(1);

      // Cleanup
      cleanup();
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('WidgetUpdateManager', () => {
    it('requestUpdate is a no-op on non-Android platforms', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      await expect(widgetHelper.WidgetUpdateManager.requestUpdate()).resolves.toBeUndefined();
    });

    it('requestUpdate logs message on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await widgetHelper.WidgetUpdateManager.requestUpdate();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Widget update requested'));

      consoleSpy.mockRestore();
    });
  });

  describe('WIDGET_TIMER_KEY', () => {
    it('exports the expected settings key', () => {
      expect(widgetHelper.WIDGET_TIMER_KEY).toBe('widget_timer_start');
    });
  });
});
