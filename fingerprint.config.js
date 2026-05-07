/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips: [
    'ExpoConfigVersions',
    'GitIgnore',
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
  ],
  ignorePaths: ['.easignore'],
  fileHookTransform: (source, chunk) => {
    if (!chunk) {
      return chunk;
    }

    // 1. Sanitize package.json and package-lock.json to ignore semantic-release version bumps
    if (source.type === 'file') {
      if (source.filePath === 'package.json') {
        const packageJson = JSON.parse(chunk.toString());
        delete packageJson.version;
        return Buffer.from(JSON.stringify(packageJson, null, 2));
      }

      if (source.filePath === 'package-lock.json') {
        const packageLockJson = JSON.parse(chunk.toString());
        delete packageLockJson.version;
        if (packageLockJson.packages && packageLockJson.packages['']) {
          delete packageLockJson.packages[''].version;
        }
        return Buffer.from(JSON.stringify(packageLockJson, null, 2));
      }
    }

    // 2. Sanitize the evaluated app.config.js (expoConfig)
    if (source.type === 'contents' && source.id === 'expoConfig') {
      const appConfig = JSON.parse(chunk.toString());

      // Strip the version here as well, because app.config.js reads it directly
      // from the raw package.json before the fingerprint tool sanitizes the file above.
      if (appConfig.version) {
        delete appConfig.version;
      }

      // Normalize plugins to remove abiFilters restrictions so dev and prod match
      if (appConfig.plugins) {
        appConfig.plugins = appConfig.plugins.map((plugin) => {
          // Force withAbiFilters to an empty array
          if (Array.isArray(plugin) && plugin[0] === './withAbiFilters') {
            return ['./withAbiFilters', { abiFilters: [] }];
          }

          // Force expo-build-properties to strip out android.buildArchs
          if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
            const [name, options] = plugin;
            const newOptions = JSON.parse(JSON.stringify(options || {}));

            if (newOptions.android && newOptions.android.buildArchs) {
              delete newOptions.android.buildArchs;
            }
            return [name, newOptions];
          }

          return plugin;
        });
      }

      return Buffer.from(JSON.stringify(appConfig));
    }

    return chunk;
  },
};
