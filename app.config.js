// app.config.js extends app.json.
const { withAndroidManifest } = require('@expo/config-plugins');

// Plugin to add permissions and services for the background task
const withBackgroundService = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Add required permissions
    androidManifest.manifest['uses-permission'] = [
      ...(androidManifest.manifest['uses-permission'] || []),
      { $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' } },
      { $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_SHORT_SERVICE' } },
      { $: { 'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED' } },
    ];

    const application = androidManifest.manifest.application[0];
    if (!application) {
      console.warn('Warning: No application element found in AndroidManifest.xml');
      return config;
    }

    // Add the background service
    // android:foregroundServiceType is required on targetSdkVersion >= 34 (Android 14+).
    // 'shortService' avoids the 6-hour dataSync quota exhaustion by design: it has no
    // cumulative quota, only a ~3-minute per-run hard limit. The task performs one quick
    // scheduling tick and then stops, so the time limit is never reached.
    if (!application.service) application.service = [];
    application.service.push({
      $: {
        'android:name': 'com.asterinet.react.bgactions.RNBackgroundActionsTask',
        'android:foregroundServiceType': 'shortService',
      },
    });

    // Add the boot receiver
    if (!application.receiver) application.receiver = [];
    application.receiver.push({
      $: {
        'android:name': 'com.asterinet.react.bgactions.RNBackgroundActionsBootReceiver',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
        },
      ],
    });

    return config;
  });
};


// For production EAS builds, ABI filters are removed so that Google Play can handle
// architecture splitting from the AAB. All other profiles keep the arm64-v8a restriction
// to produce smaller preview/development APKs.
module.exports = ({ config }) => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

  // Apply the new background service plugin to all configurations
  config = withBackgroundService(config);

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
