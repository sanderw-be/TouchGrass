const { withGradleProperties, withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const withAbiFilters = (config, { abiFilters = ['arm64-v8a'] } = {}) => {
  console.log('🔧 ABI Filter plugin is running!', abiFilters);

  // Set gradle.properties
  config = withGradleProperties(config, (config) => {
    // Convert array to comma-separated string for gradle.properties
    const architecturesString = abiFilters.join(',');

    // Set the reactNativeArchitectures property
    config.modResults = config.modResults.filter(
      (item) => !item.key || item.key !== 'reactNativeArchitectures',
    );

    config.modResults.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: architecturesString,
    });

    return config;
  });

  // Set build.gradle ndk.abiFilters
  config = withAppBuildGradle(config, (config) => {
    const abiFiltersString = abiFilters.map((abi) => `"${abi}"`).join(', ');

    // Add ndk abiFilters to defaultConfig
    if (config.modResults.contents.includes('defaultConfig {')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(defaultConfig\s*\{[^}]*versionName\s+[^}]*)/,
        `$1
        
        ndk {
            abiFilters ${abiFiltersString}
        }`,
      );
    }

    return config;
  });

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