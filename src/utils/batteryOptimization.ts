import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

const DEFAULT_ANDROID_PACKAGE = 'com.jollyheron.touchgrass';

const getAndroidPackageName = () =>
  Constants.expoConfig?.android?.package ??
  Constants.manifest?.android?.package ??
  DEFAULT_ANDROID_PACKAGE;

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
