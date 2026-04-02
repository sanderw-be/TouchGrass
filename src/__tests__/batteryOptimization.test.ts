import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import {
  BATTERY_OPTIMIZATION_SETTING_KEY,
  isBatteryOptimizationDisabled,
  openBatteryOptimizationSettings,
  refreshBatteryOptimizationSetting,
} from '../utils/batteryOptimization';

jest.mock('expo-constants', () => ({
  expoConfig: { android: { package: 'com.jollyheron.touchgrass' } },
  manifest: { android: { package: 'com.jollyheron.touchgrass' } },
}));

jest.mock('expo-battery', () => ({
  isBatteryOptimizationEnabledAsync: jest.fn(),
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
  ActivityAction: {
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
}));

const mockSetSetting = jest.fn();
jest.mock('../storage/database', () => ({
  setSetting: (key: string, value: string) => mockSetSetting(key, value),
}));

const mockIsBatteryOptimizationEnabledAsync =
  Battery.isBatteryOptimizationEnabledAsync as jest.MockedFunction<
    typeof Battery.isBatteryOptimizationEnabledAsync
  >;
const originalPlatformOS = Platform.OS;

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

describe('battery optimization status helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
  });

  afterAll(() => {
    (Platform as any).OS = originalPlatformOS;
  });

  it('returns true when optimization is disabled', async () => {
    (Platform as any).OS = 'android';
    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(false);

    await expect(isBatteryOptimizationDisabled()).resolves.toBe(true);
  });

  it('returns false when optimization is enabled', async () => {
    (Platform as any).OS = 'android';
    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(true);

    await expect(isBatteryOptimizationDisabled()).resolves.toBe(false);
  });

  it('stores granted status when refreshed', async () => {
    (Platform as any).OS = 'android';
    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(true);

    await expect(refreshBatteryOptimizationSetting()).resolves.toBe(false);
    expect(mockSetSetting).toHaveBeenCalledWith(BATTERY_OPTIMIZATION_SETTING_KEY, '0');

    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(false);
    await expect(refreshBatteryOptimizationSetting()).resolves.toBe(true);
    expect(mockSetSetting).toHaveBeenCalledWith(BATTERY_OPTIMIZATION_SETTING_KEY, '1');
  });
});
