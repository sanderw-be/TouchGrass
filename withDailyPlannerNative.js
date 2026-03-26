/**
 * Expo config plugin for the daily-planner-native module.
 *
 * This plugin adds the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission to
 * AndroidManifest.xml so the app can programmatically open the battery
 * optimization whitelist dialog.
 *
 * The remaining manifest entries (service, receivers) are declared in the
 * module's own AndroidManifest.xml and merged automatically by the Android
 * Gradle build.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const withDailyPlannerNative = (config) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure <uses-permission> array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const perms = manifest['uses-permission'];

    // Add REQUEST_IGNORE_BATTERY_OPTIMIZATIONS if not already present
    const batteryPerm = 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
    const hasBatteryPerm = perms.some(
      (p) => p?.$?.['android:name'] === batteryPerm,
    );
    if (!hasBatteryPerm) {
      perms.push({ $: { 'android:name': batteryPerm } });
    }

    // Add SCHEDULE_EXACT_ALARM if not already present
    const exactAlarmPerm = 'android.permission.SCHEDULE_EXACT_ALARM';
    const hasExactAlarmPerm = perms.some(
      (p) => p?.$?.['android:name'] === exactAlarmPerm,
    );
    if (!hasExactAlarmPerm) {
      perms.push({ $: { 'android:name': exactAlarmPerm } });
    }

    return config;
  });

  return config;
};

module.exports = withDailyPlannerNative;
