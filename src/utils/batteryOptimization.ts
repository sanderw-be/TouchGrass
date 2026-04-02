import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

const DEFAULT_ANDROID_PACKAGE = 'com.jollyheron.touchgrass';

type AndroidPackageConfig = {
  android?: {
    package?: string;
  };
};

const getAndroidPackageName = () => {
  const manifestAndroidPackage = (Constants.manifest as AndroidPackageConfig | null)?.android
    ?.package;

  return (
    Constants.expoConfig?.android?.package ?? manifestAndroidPackage ?? DEFAULT_ANDROID_PACKAGE
  );
};

export const BATTERY_OPTIMIZATION_SETTING_KEY = 'battery_optimization_granted';

export const openBatteryOptimizationSettings = async (): Promise<boolean> => {
  const packageName = getAndroidPackageName();
  const requestParams = packageName ? { data: `package:${packageName}` } : undefined;

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      requestParams
    );
    return true;
  } catch (error) {
    console.error('Error requesting battery optimization exemption:', error);
  }

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    );
    return true;
  } catch (error) {
    console.error('Error opening battery optimization settings:', error);
  }

  return false;
};
