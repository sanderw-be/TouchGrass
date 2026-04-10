#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: update-app-version.js <version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid version format: "${version}". Expected semver (e.g. 1.2.3)`);
  process.exit(1);
}

const appJsonPath = path.resolve(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const currentVersionCode = appJson?.expo?.android?.versionCode;

if (typeof currentVersionCode !== 'number' || !Number.isInteger(currentVersionCode)) {
  console.error(`Invalid versionCode in app.json: "${currentVersionCode}". Expected an integer.`);
  process.exit(1);
}

const alreadyAtVersion = appJson.expo.version === version;

appJson.expo.version = version;
// Only increment versionCode when the version is actually changing.
// This prevents a double-increment when step 1 (dry-run commit) and
// step 2 (real semantic-release) both call this script for the same version.
if (!alreadyAtVersion) {
  appJson.expo.android.versionCode = currentVersionCode + 1;
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

console.log(
  `Updated app.json: version=${version}, versionCode=${appJson.expo.android.versionCode}`
);
