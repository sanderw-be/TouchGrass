// app.config.js extends app.json.
// For production EAS builds, ABI filters are removed so that Google Play can handle
// architecture splitting from the AAB. All other profiles keep the arm64-v8a restriction
// to produce smaller preview/development APKs.
module.exports = ({ config }) => {
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
