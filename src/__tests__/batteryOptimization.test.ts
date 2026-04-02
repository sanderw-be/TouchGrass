import * as IntentLauncher from 'expo-intent-launcher';
import { openBatteryOptimizationSettings } from '../utils/batteryOptimization';

jest.mock('expo-constants', () => ({
  expoConfig: { android: { package: 'com.jollyheron.touchgrass' } },
  manifest: { android: { package: 'com.jollyheron.touchgrass' } },
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
  ActivityAction: {
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
}));

describe('openBatteryOptimizationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests ignore battery optimizations for the app package', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockResolvedValueOnce({});

    const opened = await openBatteryOptimizationSettings();

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:com.jollyheron.touchgrass' }
    );
    expect(opened).toBe(true);
  });

  it('falls back to the overview settings when the request intent fails', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock)
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce({});

    const opened = await openBatteryOptimizationSettings();

    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      1,
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:com.jollyheron.touchgrass' }
    );
    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      2,
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
    expect(opened).toBe(true);
  });

  it('returns false when both intents fail', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValue(new Error('fail'));

    const opened = await openBatteryOptimizationSettings();

    expect(opened).toBe(false);
  });
});
