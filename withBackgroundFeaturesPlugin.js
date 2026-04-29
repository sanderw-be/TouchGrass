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

const BG_FEATURES_MODULE_KT = `\\
package \${JAVA_PACKAGE}

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
  fun registerActivityTransitions(promise: Promise) {
    try {
      val transitions = mutableListOf<com.google.android.gms.location.ActivityTransition>()
      val activities = listOf(
          com.google.android.gms.location.DetectedActivity.IN_VEHICLE,
          com.google.android.gms.location.DetectedActivity.STILL,
          com.google.android.gms.location.DetectedActivity.WALKING,
          com.google.android.gms.location.DetectedActivity.RUNNING,
          com.google.android.gms.location.DetectedActivity.ON_BICYCLE
      )
      
      for (activity in activities) {
          transitions.add(com.google.android.gms.location.ActivityTransition.Builder()
              .setActivityType(activity)
              .setActivityTransition(com.google.android.gms.location.ActivityTransition.ACTIVITY_TRANSITION_ENTER)
              .build())
          transitions.add(com.google.android.gms.location.ActivityTransition.Builder()
              .setActivityType(activity)
              .setActivityTransition(com.google.android.gms.location.ActivityTransition.ACTIVITY_TRANSITION_EXIT)
              .build())
      }

      val request = com.google.android.gms.location.ActivityTransitionRequest(transitions)
      val intent = android.content.Intent(reactContext, ActivityTransitionReceiver::class.java)
      val pendingIntent = android.app.PendingIntent.getBroadcast(
          reactContext,
          0,
          intent,
          android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      )

      val client = com.google.android.gms.location.ActivityRecognition.getClient(reactContext)
      client.requestActivityTransitionUpdates(request, pendingIntent)
          .addOnSuccessListener { promise.resolve(null) }
          .addOnFailureListener { e -> promise.reject("TRANSITION_REG_FAILED", e) }
    } catch (e: Exception) {
      promise.reject("TRANSITION_ERROR", e)
    }
  }
}
`;

const BG_FEATURES_PACKAGE_KT = `\\
package \${JAVA_PACKAGE}

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

const SMART_REMINDER_RECEIVER_KT = `\\
package \${JAVA_PACKAGE}

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

const BOOT_RESTORE_RECEIVER_KT = `\\
package \${JAVA_PACKAGE}

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

const ACTIVITY_TRANSITION_RECEIVER_KT = `\\
package \${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.android.gms.location.ActivityTransitionResult

class ActivityTransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      if (ActivityTransitionResult.hasResult(intent)) {
          val result = ActivityTransitionResult.extractResult(intent)
          if (result != null) {
              for (event in result.transitionEvents) {
                  Log.d("TouchGrass", "Activity Transition: \${event.activityType} - \${event.transitionType}")
                  val headlessIntent = Intent(context, ActivityTransitionHeadlessService::class.java).apply {
                      putExtra("activityType", event.activityType)
                      putExtra("transitionType", event.transitionType)
                  }
                  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                      context.startForegroundService(headlessIntent)
                  } else {
                      context.startService(headlessIntent)
                  }
              }
          }
      }
    } catch (e: Exception) {
      Log.e("TouchGrass", "[SR_TRANSITION] Error in onReceive", e)
    }
  }
}
`;

const ACTIVITY_TRANSITION_HEADLESS_SERVICE_KT = `\\
package \${JAVA_PACKAGE}

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ActivityTransitionHeadlessService : HeadlessJsTaskService() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel("touchgrass_headless_bg") == null) {
                val channel = NotificationChannel("touchgrass_headless_bg", "Background tasks", NotificationManager.IMPORTANCE_MIN)
                channel.setShowBadge(false)
                nm.createNotificationChannel(channel)
            }
            val notification = NotificationCompat.Builder(this, "touchgrass_headless_bg")
                .setContentTitle("TouchGrass Activity Sync")
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setShowWhen(false).build()
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(1002, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
            } else {
                startForeground(1002, notification)
            }
        }
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val data = Arguments.createMap()
        intent?.extras?.let { extras ->
            for (key in extras.keySet()) {
                val value = extras.get(key)
                if (value is String) data.putString(key, value)
                else if (value is Int) data.putInt(key, value)
            }
        }
        return HeadlessJsTaskConfig("ActivityTransitionTask", data, 10000L, true)
    }

    override fun onHeadlessJsTaskFinish(taskId: Int) {
        super.onHeadlessJsTaskFinish(taskId)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
}
`;

const SCHEDULE_FAILSAFE_WORKER_KT = `\\
package \${JAVA_PACKAGE}

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
        'ActivityTransitionHeadlessService.kt': ACTIVITY_TRANSITION_HEADLESS_SERVICE_KT,
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
    const lines = contents.split('\\n');
    const lastImportIdx = lines.reduce(
      (max, line, i) => (line.trimStart().startsWith('import ') ? i : max),
      -1
    );
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, \`import \${JAVA_PACKAGE}.BackgroundFeaturesPackage\`);
    }
    contents = lines.join('\\n');

    // Add package to list
    contents = contents.replace(
      /(PackageList\\(this\\)\\.packages\\.apply\\s*\\{)/,
      \`$1\\n              add(BackgroundFeaturesPackage())\`
    );

    config.modResults.contents = contents;
    return config;
  });

  // 3. Update AndroidManifest.xml for Receivers
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add permissions
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SHORT_SERVICE',
      'android.permission.ACTIVITY_RECOGNITION'
    ];
    for (const permission of permissions) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }

    const application = manifest.application?.[0];
    if (!application) return config;

    application.receiver = application.receiver ?? [];

    const addReceiver = (name, exported, intentFilters = null) => {
      const fullName = \`\${JAVA_PACKAGE}.\${name}\`;
      if (!application.receiver.some((r) => r.$?.['android:name'] === fullName)) {
        const receiverObj = { $: { 'android:name': fullName, 'android:exported': exported } };
        if (intentFilters) receiverObj['intent-filter'] = intentFilters;
        application.receiver.push(receiverObj);
      }
    };

    const addService = (name, exported, foregroundServiceType = null) => {
      const fullName = \`\${JAVA_PACKAGE}.\${name}\`;
      application.service = application.service ?? [];
      let service = application.service.find((s) => s.$?.['android:name'] === fullName);
      if (!service) {
        service = { $: { 'android:name': fullName, 'android:exported': exported } };
        application.service.push(service);
      }
      if (foregroundServiceType) {
        service.$['android:foregroundServiceType'] = foregroundServiceType;
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

    addService('ActivityTransitionHeadlessService', 'false', 'shortService');

    return config;
  });

  // 4. Inject Native Dependencies
  config = withAppBuildGradle(config, (config) => {
    const dependencies = \`
    // Added by withBackgroundFeaturesPlugin
    implementation 'com.google.android.gms:play-services-location:21.2.0'
    implementation 'androidx.work:work-runtime-ktx:2.9.0'
    \`;

    if (!config.modResults.contents.includes('play-services-location')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\\s*\\{/,
        \`dependencies {\\n\${dependencies}\`
      );
    }
    return config;
  });

  return config;
};

module.exports = withBackgroundFeaturesPlugin;
