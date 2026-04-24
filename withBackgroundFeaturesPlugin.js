'use strict';

const {
  withDangerousMod,
  withAndroidManifest,
  withMainApplication,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const JAVA_PACKAGE = 'expo.modules.backgroundfeatures';
const JAVA_SUBPATH = JAVA_PACKAGE.split('.').join('/');

// ---------------------------------------------------------------------------
// Kotlin Source Files (Scaffolding)
// ---------------------------------------------------------------------------

const BG_FEATURES_MODULE_KT = `\
package ${JAVA_PACKAGE}

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray

/**
 * Native module for Activity Recognition and Smart Reminders coordination.
 */
class BackgroundFeaturesModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BackgroundFeaturesNative"

  // --- SMART REMINDERS ---
  @ReactMethod
  fun scheduleReminders(scheduleArray: ReadableArray, promise: Promise) {
    // TODO: Save schedule to native storage (SharedPreferences/MMKV)
    // TODO: Set Exact Alarms via AlarmManager
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelAllReminders(promise: Promise) {
    // TODO: Cancel all scheduled PendingIntents
    promise.resolve(null)
  }

  // --- ACTIVITY RECOGNITION ---
  @ReactMethod
  fun startActivityRecognition(promise: Promise) {
    // TODO: Register ActivityTransitionRequest
    promise.resolve(null)
  }

  @ReactMethod
  fun stopActivityRecognition(promise: Promise) {
    // TODO: Unregister transitions
    promise.resolve(null)
  }
}
`;

const BG_FEATURES_PACKAGE_KT = `\
package ${JAVA_PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BackgroundFeaturesPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(BackgroundFeaturesModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

const SMART_REMINDER_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SmartReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pendingResult = goAsync()
    try {
      // TODO: Evaluate weather/goals and conditionally fire notification
      // TODO: Chain next alarm via Headless JS
    } finally {
      pendingResult.finish()
    }
  }
}
`;

const BOOT_RESTORE_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    
    val pendingResult = goAsync()
    try {
      // TODO: Restore Exact Alarms from storage
    } finally {
      pendingResult.finish()
    }
  }
}
`;

const ACTIVITY_TRANSITION_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ActivityTransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pendingResult = goAsync()
    try {
      // TODO: Handle ActivityTransitionResult (Wake up location tracking or filter IN_VEHICLE)
    } finally {
      pendingResult.finish()
    }
  }
}
`;

const SCHEDULE_FAILSAFE_WORKER_KT = `\
package ${JAVA_PACKAGE}

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class ScheduleFailsafeWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    // TODO: Verify alarm chain and regenerate via Headless JS if broken
    return Result.success()
  }
}
`;

// ---------------------------------------------------------------------------
// Config Plugin
// ---------------------------------------------------------------------------

const withBackgroundFeaturesPlugin = (config) => {
  // 1. Write Kotlin source files at prebuild
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const javaDir = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        ...JAVA_SUBPATH.split('/')
      );
      fs.mkdirSync(javaDir, { recursive: true });

      const files = {
        'BackgroundFeaturesModule.kt': BG_FEATURES_MODULE_KT,
        'BackgroundFeaturesPackage.kt': BG_FEATURES_PACKAGE_KT,
        'SmartReminderReceiver.kt': SMART_REMINDER_RECEIVER_KT,
        'BootRestoreReceiver.kt': BOOT_RESTORE_RECEIVER_KT,
        'ActivityTransitionReceiver.kt': ACTIVITY_TRANSITION_RECEIVER_KT,
        'ScheduleFailsafeWorker.kt': SCHEDULE_FAILSAFE_WORKER_KT,
      };

      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(javaDir, filename), content, 'utf8');
      }
      return config;
    },
  ]);

  // 2. Register the ReactPackage in MainApplication
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('BackgroundFeaturesPackage')) return config;

    // Add import
    const lines = contents.split('\n');
    const lastImportIdx = lines.reduce(
      (max, line, i) => (line.trimStart().startsWith('import ') ? i : max),
      -1
    );
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, `import ${JAVA_PACKAGE}.BackgroundFeaturesPackage`);
    }
    contents = lines.join('\n');

    // Add package to list
    contents = contents.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{)/,
      `$1\n              add(BackgroundFeaturesPackage())`
    );

    config.modResults.contents = contents;
    return config;
  });

  // 3. Update AndroidManifest.xml for Receivers
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    application.receiver = application.receiver ?? [];

    const addReceiver = (name, exported, intentFilters = null) => {
      const fullName = `${JAVA_PACKAGE}.${name}`;
      if (!application.receiver.some((r) => r.$?.['android:name'] === fullName)) {
        const receiverObj = { $: { 'android:name': fullName, 'android:exported': exported } };
        if (intentFilters) receiverObj['intent-filter'] = intentFilters;
        application.receiver.push(receiverObj);
      }
    };

    addReceiver('SmartReminderReceiver', 'false');
    addReceiver('ActivityTransitionReceiver', 'false');
    addReceiver('BootRestoreReceiver', 'true', [
      {
        action: [
          { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
          { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
        ],
      },
    ]);

    return config;
  });

  // 4. Inject Native Dependencies
  config = withAppBuildGradle(config, (config) => {
    const dependencies = `
    // Added by withBackgroundFeaturesPlugin
    implementation 'com.google.android.gms:play-services-location:21.2.0'
    implementation 'androidx.work:work-runtime-ktx:2.9.0'
    `;

    if (!config.modResults.contents.includes('play-services-location')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {\n${dependencies}`
      );
    }
    return config;
  });

  return config;
};

module.exports = withBackgroundFeaturesPlugin;
