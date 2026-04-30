const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const withAbiFilters = (config, { abiFilters = ['arm64-v8a'] } = {}) => {
  // Set build.gradle ndk.abiFilters only when architectures are specified.
  // An empty abiFilters array means "all architectures" (e.g. for Play Store AAB builds).
  if (abiFilters.length > 0) {
    config = withAppBuildGradle(config, (config) => {
      const abiFiltersString = abiFilters.map((abi) => `"${abi}"`).join(', ');

      // Add ndk abiFilters to defaultConfig
      if (
        config.modResults.contents.includes('defaultConfig {') &&
        !config.modResults.contents.includes('abiFilters')
      ) {
        config.modResults.contents = config.modResults.contents.replace(
          /defaultConfig\s*\{/,
          `defaultConfig {\n        ndk {\n            abiFilters ${abiFiltersString}\n        }`
        );
      }

      return config;
    });
  }

  // Enable OnBackInvokedCallback to suppress the Android warning and support predictive back gesture
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    if (application && application.$) {
      application.$['android:enableOnBackInvokedCallback'] = 'true';
    }
    return config;
  });

  return config;
};

module.exports = withAbiFilters;
