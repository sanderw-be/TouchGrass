// app.config.js extends app.json.
// It injects the daily-planner-native config plugin (AndroidManifest modifications)
// and, for production EAS builds, removes ABI filters so that Google Play can handle
// architecture splitting from the AAB. All other profiles keep the arm64-v8a restriction
// to produce smaller preview/development APKs.
const { withAndroidManifest } = require('@expo/config-plugins');

const withDailyPlannerNative = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const mainApplication = androidManifest.application[0];

    // 1. Add Permissions
    const permissions = [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ];

    if (!androidManifest['uses-permission']) androidManifest['uses-permission'] = [];
    permissions.forEach((perm) => {
      if (!androidManifest['uses-permission'].find((p) => p.$['android:name'] === perm)) {
        androidManifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    });

    // 2. Add Native Components (services + receivers)
    if (!mainApplication.service) mainApplication.service = [];
    if (!mainApplication.receiver) mainApplication.receiver = [];

    const pkg = 'expo.modules.dailyplannernative';

    const services = [`${pkg}.DailyPlannerHeadlessService`];
    const receivers = [`${pkg}.ExactAlarmReceiver`, `${pkg}.BootReceiver`];

    services.forEach((s) => {
      if (!mainApplication.service.find((item) => item.$['android:name'] === s)) {
        mainApplication.service.push({ $: { 'android:name': s, 'android:exported': 'false' } });
      }
    });

    receivers.forEach((r) => {
      if (!mainApplication.receiver.find((item) => item.$['android:name'] === r)) {
        const receiverNode = { $: { 'android:name': r, 'android:exported': 'false' } };
        if (r.includes('BootReceiver')) {
          receiverNode['intent-filter'] = [
            { action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] },
          ];
          receiverNode.$['android:enabled'] = 'true';
          receiverNode.$['android:directBootAware'] = 'true';
        }
        mainApplication.receiver.push(receiverNode);
      }
    });

    return config;
  });
};

module.exports = ({ config }) => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

  // Inject the daily-planner-native config plugin for AndroidManifest modifications.
  let plugins = [...(config.plugins ?? []), withDailyPlannerNative];

  if (isProduction) {
    // Remove the arm64-only restriction for production (Play Store AAB) builds.
    plugins = plugins.map((plugin) => {
      // Pass an empty abiFilters array so withAbiFilters skips the NDK block
      // while still applying the android:enableOnBackInvokedCallback manifest fix.
      if (Array.isArray(plugin) && plugin[0] === './withAbiFilters') {
        return ['./withAbiFilters', { abiFilters: [] }];
      }

      // Remove the buildArchs restriction from expo-build-properties.
      if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
        const [name, options] = plugin;
        const newOptions = structuredClone(options);
        if (newOptions.android) {
          delete newOptions.android.buildArchs;
        }
        return [name, newOptions];
      }

      return plugin;
    });
  }

  return { ...config, plugins };
};
