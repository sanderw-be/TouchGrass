module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;

  // Define which profiles need all architectures (Emulators and Play Store)
  const isMultiArchProfile = profile === 'production' || profile === 'preview-emulator';

  // If it's a device-only profile (development, preview), return config as-is
  // to keep the arm64-v8a restriction and speed up the build.
  if (!isMultiArchProfile) {
    return config;
  }

  // Otherwise, remove the arm64-only restrictions for multi-arch builds.
  const plugins = (config.plugins ?? []).map((plugin) => {
    // Pass an empty abiFilters array so withAbiFilters skips the NDK block
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
