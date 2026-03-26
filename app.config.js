const { withAndroidManifest } = require('@expo/config-plugins');

// Config plugin: inject permissions, services, and receivers for the native
// daily-planner module into the Android manifest.
const withDailyPlannerNative = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // --- Permissions ---------------------------------------------------
    const permissionsToAdd = [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.FOREGROUND_SERVICE',
    ];
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const existing = manifest['uses-permission'].map((p) => p.$?.['android:name']);
    for (const perm of permissionsToAdd) {
      if (!existing.includes(perm)) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    // --- Application children (services + receivers) --------------------
    const app = manifest.application?.[0];
    if (app) {
      if (!app.service) app.service = [];
      if (!app.receiver) app.receiver = [];

      // HeadlessJS task service
      const svcName = 'expo.modules.dailyplannernative.DailyPlannerHeadlessTaskService';
      if (!app.service.some((s) => s.$?.['android:name'] === svcName)) {
        app.service.push({
          $: {
            'android:name': svcName,
            'android:enabled': 'true',
            'android:exported': 'false',
            'android:foregroundServiceType': 'shortService',
          },
        });
      }

      // Exact alarm receiver
      const exactName = 'expo.modules.dailyplannernative.ExactAlarmReceiver';
      if (!app.receiver.some((r) => r.$?.['android:name'] === exactName)) {
        app.receiver.push({
          $: { 'android:name': exactName, 'android:enabled': 'true', 'android:exported': 'false' },
        });
      }

      // Boot receiver
      const bootName = 'expo.modules.dailyplannernative.BootReceiver';
      if (!app.receiver.some((r) => r.$?.['android:name'] === bootName)) {
        app.receiver.push({
          $: { 'android:name': bootName, 'android:enabled': 'true', 'android:exported': 'true' },
          'intent-filter': [
            { action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] },
          ],
        });
      }
    }

    return config;
  });
};

// app.config.js extends app.json.
// For production EAS builds, ABI filters are removed so that Google Play can handle
// architecture splitting from the AAB. All other profiles keep the arm64-v8a restriction
// to produce smaller preview/development APKs.
module.exports = ({ config }) => {
  // Always apply the daily planner manifest plugin.
  config = withDailyPlannerNative(config);

  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

  if (!isProduction) {
    return config;
  }

  // Remove the arm64-only restriction for production (Play Store AAB) builds.
  const plugins = (config.plugins ?? []).map((plugin) => {
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

  return { ...config, plugins };
};
