const { withPlugins, withAndroidManifest, withMainApplication, withMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withCopyFiles = (config) => {
    return withMod(config, {
        platform: 'android',
        mod: 'main',
        action: async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const platformRoot = config.modRequest.platformProjectRoot;
            const srcDir = path.join(projectRoot, 'plugins', 'withChainedAlarm', 'src');
            const destDir = path.join(platformRoot, 'app', 'src', 'main', 'java', 'com', 'jollyheron', 'touchgrass');

            const files = [
                'AlarmReceiver.kt',
                'AlarmSchedulerModule.kt',
                'AlarmSchedulerPackage.kt',
                'BackgroundPulsarService.kt',
                'ReminderHeadlessTaskService.kt',
            ];

            for (const file of files) {
                const src = path.join(srcDir, file);
                const dest = path.join(destDir, file);
                await fs.promises.copyFile(src, dest);
            }
            
            return config;
        }
    });
};

const withAndroidManifestModifications = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Add permissions
        const permissions = [
            'android.permission.FOREGROUND_SERVICE_SHORT_SERVICE',
            'android.permission.SCHEDULE_EXACT_ALARM',
            'android.permission.POST_NOTIFICATIONS',
            'android.permission.WAKE_LOCK',
        ];

        if (!androidManifest.manifest['uses-permission']) {
            androidManifest.manifest['uses-permission'] = [];
        }

        for (const permission of permissions) {
            if (!androidManifest.manifest['uses-permission'].some(p => p.$['android:name'] === permission)) {
                androidManifest.manifest['uses-permission'].push({
                    $: { 'android:name': permission },
                });
            }
        }
        
        const application = androidManifest.manifest.application[0];
        const packageName = config.android.package;

        // Add receiver
        if (!application.receiver) {
            application.receiver = [];
        }
        if (!application.receiver.some(r => r.$['android:name'] === `${packageName}.AlarmReceiver`)) {
            application.receiver.push({
                $: {
                    'android:name': `${packageName}.AlarmReceiver`,
                    'android:exported': 'false',
                },
            });
        }

        // Add services
        if (!application.service) {
            application.service = [];
        }
        if (!application.service.some(s => s.$['android:name'] === `${packageName}.BackgroundPulsarService`)) {
            application.service.push({
                $: {
                    'android:name': `${packageName}.BackgroundPulsarService`,
                    'android:foregroundServiceType': 'shortService',
                    'android:exported': 'false',
                },
            });
        }
        if (!application.service.some(s => s.$['android:name'] === `${packageName}.ReminderHeadlessTaskService`)) {
            application.service.push({
                $: {
                    'android:name': `${packageName}.ReminderHeadlessTaskService`,
                    'android:exported': 'false',
                },
            });
        }

        return config;
    });
};

const withMainApplicationModifications = (config) => {
    return withMainApplication(config, async (config) => {
        const mainApplication = config.modResults;
        const packageName = config.android.package;

        // Add the package to the packageList
        const packagesApply = mainApplication.contents.match(/PackageList\(this\)\.packages\.apply \{([^}]+)\}/);
        if (packagesApply) {
            if (!packagesApply[0].includes('add(AlarmSchedulerPackage())')) {
                const newPackagesApply = packagesApply[0].replace(
                    '// add(MyReactNativePackage())',
                    `// add(MyReactNativePackage())\\n          add(AlarmSchedulerPackage())`
                );
                mainApplication.contents = mainApplication.contents.replace(packagesApply[0], newPackagesApply);
            }
        }
        
        // Add import
        if (!mainApplication.contents.includes(`import ${packageName}.AlarmSchedulerPackage`)) {
            mainApplication.contents = mainApplication.contents.replace(
                'import expo.modules.ExpoReactHostFactory',
                `import expo.modules.ExpoReactHostFactory\\nimport ${packageName}.AlarmSchedulerPackage`
            );
        }


        return config;
    });
};


const withChainedAlarm = (config) => {
    return withPlugins(config, [
        withCopyFiles,
        withAndroidManifestModifications,
        withMainApplicationModifications,
    ]);
};

module.exports = withChainedAlarm;