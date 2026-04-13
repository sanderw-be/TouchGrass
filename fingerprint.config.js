/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ['ExpoConfigVersions'],
  fileHookTransform: (source, chunk) => {
    if (!chunk) {
      return chunk;
    }

    // For package.json, parse it, remove the version field, and return the modified content.
    // This ensures that version bumps by semantic-release do not change the fingerprint.
    if (source.type === 'file') {
      if (source.filePath === 'package.json') {
        const packageJson = JSON.parse(chunk.toString());
        delete packageJson.version;
        return JSON.stringify(packageJson, null, 2);
      }

      // Do the same for package-lock.json to ignore the root package's version.
      if (source.filePath === 'package-lock.json') {
        const packageLockJson = JSON.parse(chunk.toString());
        delete packageLockJson.version;
        // Also delete the version from the root package in the `packages` map
        if (packageLockJson.packages && packageLockJson.packages['']) {
          delete packageLockJson.packages[''].version;
        }
        return JSON.stringify(packageLockJson, null, 2);
      }
    }
    return chunk;
  },
};
