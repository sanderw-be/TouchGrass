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

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import org.json.JSONArray

class BackgroundFeaturesModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BackgroundFeaturesNative"

  @ReactMethod
  fun scheduleReminders(scheduleArray: ReadableArray, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
      val jsonArray = JSONArray()
      for (i in 0 until scheduleArray.size()) {
          val item = scheduleArray.getMap(i)
          if (item != null) {
              val obj = org.json.JSONObject()
              obj.put("timestamp", item.getDouble("timestamp"))
              obj.put("type", item.getString("type"))
              obj.put("goalThreshold", item.getDouble("goalThreshold"))
              if (item.hasKey("title")) obj.put("title", item.getString("title"))
              if (item.hasKey("body")) obj.put("body", item.getString("body"))
              
              if (item.hasKey("contributors")) {
                  val contributorsArr = item.getArray("contributors")
                  if (contributorsArr != null) {
                      val contributorsJson = JSONArray()
                      for (j in 0 until contributorsArr.size()) {
                          contributorsJson.put(contributorsArr.getString(j))
                      }
                      obj.put("contributors", contributorsJson.toString())
                  }
              }
              jsonArray.put(obj)
          }
      }
      prefs.edit().putString("reminder_schedule", jsonArray.toString()).apply()

      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val sdf = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
      
      for (i in 0 until jsonArray.length()) {
          val item = jsonArray.getJSONObject(i)
          val timestamp = item.getLong("timestamp")
          val formattedTime = sdf.format(java.util.Date(timestamp))
          Log.d("TouchGrass", "[SR_SCHEDULING] next notification planned at " + formattedTime + " (type=" + item.getString("type") + ")")
          
          val intent = Intent(reactContext, SmartReminderReceiver::class.java).apply {
              action = reactContext.packageName + ".ACTION_SMART_REMINDER"
              putExtra("type", item.getString("type"))
              if (item.has("title")) putExtra("title", item.getString("title"))
              if (item.has("body")) putExtra("body", item.getString("body"))
              if (item.has("contributors")) putExtra("contributors", item.getString("contributors"))
          }
          val pendingIntent = PendingIntent.getBroadcast(
              reactContext,
              i,
              intent,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
          
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              if (alarmManager.canScheduleExactAlarms()) {
                  alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
              } else {
                  alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
              }
          } else {
              alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
          }
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SCHEDULING_ERROR", e)
    }
  }

  @ReactMethod
  fun cancelAllReminders(promise: Promise) {
    try {
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(reactContext, SmartReminderReceiver::class.java).apply {
          action = reactContext.packageName + ".ACTION_SMART_REMINDER"
      }
      
      val prefs = reactContext.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
      val scheduleStr = prefs.getString("reminder_schedule", null)
      var sweepLimit = 100 // "Safe Sweep" ceiling for legacy intents
      
      if (scheduleStr != null) {
          try {
              val jsonArray = JSONArray(scheduleStr)
              if (jsonArray.length() > sweepLimit) {
                  sweepLimit = jsonArray.length()
              }
          } catch (e: Exception) {
              Log.e("TouchGrass", "[SR_CANCEL] Error parsing schedule for count", e)
          }
      }

      for (i in 0 until sweepLimit) {
          // FLAG_NO_CREATE: Returns null if it doesn't exist. Contiguous indices not required.
          val pendingIntent = PendingIntent.getBroadcast(
              reactContext,
              i,
              intent,
              PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
          )
          if (pendingIntent != null) {
              alarmManager.cancel(pendingIntent)
              pendingIntent.cancel()
          }
      }
      
      prefs.edit().remove("reminder_schedule").apply()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CANCEL_ERROR", e)
    }
  }

  @ReactMethod
  fun registerActivityTransitions(promise: Promise) {
    try {
      val transitions = mutableListOf<ActivityTransition>()
      val activities = listOf(
          DetectedActivity.IN_VEHICLE,
          DetectedActivity.STILL,
          DetectedActivity.WALKING,
          DetectedActivity.RUNNING,
          DetectedActivity.ON_BICYCLE
      )
      
      for (activity in activities) {
          transitions.add(ActivityTransition.Builder()
              .setActivityType(activity)
              .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
              .build())
          transitions.add(ActivityTransition.Builder()
              .setActivityType(activity)
              .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
              .build())
      }

      val request = ActivityTransitionRequest(transitions)
      val intent = Intent(reactContext, ActivityTransitionReceiver::class.java)
      val pendingIntent = android.app.PendingIntent.getBroadcast(
          reactContext,
          0,
          intent,
          android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      )

      val client = ActivityRecognition.getClient(reactContext)
      client.requestActivityTransitionUpdates(request, pendingIntent)
          .addOnSuccessListener { promise.resolve(null) }
          .addOnFailureListener { e -> promise.reject("TRANSITION_REG_FAILED", e) }
    } catch (e: Exception) {
      promise.reject("TRANSITION_ERROR", e)
    }
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

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

class SmartReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != context.packageName + ".ACTION_SMART_REMINDER") return
    try {
      val type = intent.getStringExtra("type") ?: "Reminder"
      Log.d("TouchGrass", "[SR_RECEIVER] broadcastreceiver for notification called (type=$type)")
      
      Log.d("TouchGrass", "[SR_RECEIVER] Starting headless service.")
      val headlessIntent = Intent(context, SmartReminderHeadlessService::class.java).apply {
          intent.extras?.let { putExtras(it) }
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(headlessIntent)
      } else {
          context.startService(headlessIntent)
      }

    } catch (e: Exception) {
      Log.e("TouchGrass", "[SR_RECEIVER] Error in onReceive", e)
    }
  }
}
`;

const SMART_REMINDER_HEADLESS_SERVICE_KT = `\
package ${JAVA_PACKAGE}

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class SmartReminderHeadlessService : HeadlessJsTaskService() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ensureNotificationChannel()
            val notification = buildSilentNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }
    }

    private fun ensureNotificationChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Background tasks",
                    NotificationManager.IMPORTANCE_MIN
                ).apply { setShowBadge(false) }
                nm.createNotificationChannel(channel)
            }
        }
    }

    private fun buildSilentNotification(): android.app.Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TouchGrass background task")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setShowWhen(false)
            .build()
    }

    protected override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val data = Arguments.createMap()
        intent?.extras?.let { extras ->
            for (key in extras.keySet()) {
                val value = extras.get(key)
                if (value is String) data.putString(key, value)
                else if (value is Int) data.putInt(key, value)
                else if (value is Double) data.putDouble(key, value)
                else if (value is Boolean) data.putBoolean(key, value)
            }
        }
        return HeadlessJsTaskConfig(
            "SmartReminderHeadlessTask",
            data,
            10000L,
            true
        )
    }

    override fun onHeadlessJsTaskFinish(taskId: Int) {
        super.onHeadlessJsTaskFinish(taskId)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val NOTIFICATION_ID = 0x1001
        private const val CHANNEL_ID = "touchgrass_headless_bg"
    }
}
`;

const ACTIVITY_TRANSITION_HEADLESS_SERVICE_KT = `\
package ${JAVA_PACKAGE}

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

const BOOT_RESTORE_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray

class BootRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    
    try {
      Log.d("TouchGrass", "[SR_BOOT_RESTORE] broadcast receiver action [restoring alarms]")
      val prefs = context.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
      val scheduleStr = prefs.getString("reminder_schedule", null) ?: return
      
      val jsonArray = JSONArray(scheduleStr)
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val sdf = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
      
      var futureAlarmsRestored = 0
      
      for (i in 0 until jsonArray.length()) {
          val item = jsonArray.getJSONObject(i)
          val timestamp = item.getLong("timestamp")
          if (timestamp > System.currentTimeMillis()) {
              futureAlarmsRestored++
              val formattedTime = sdf.format(java.util.Date(timestamp))
              Log.d("TouchGrass", "[SR_BOOT_RESTORE] restoring alarm for " + formattedTime)
              
              val alarmIntent = Intent(context, SmartReminderReceiver::class.java).apply {
                  this.action = context.packageName + ".ACTION_SMART_REMINDER"
                  putExtra("type", item.getString("type"))
                  if (item.has("title")) putExtra("title", item.getString("title"))
                  if (item.has("body")) putExtra("body", item.getString("body"))
                  if (item.has("contributors")) putExtra("contributors", item.getString("contributors"))
              }
              val pendingIntent = PendingIntent.getBroadcast(
                  context, i, alarmIntent,
                  PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
              )
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                  if (alarmManager.canScheduleExactAlarms()) {
                      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                  } else {
                      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
                  }
              } else {
                  alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent)
              }
          }
      }

      // Native Activity Log Injection
      try {
          val dbPath = context.getDatabasePath("touchgrass.db")
          if (dbPath.exists()) {
              val db = android.database.sqlite.SQLiteDatabase.openDatabase(dbPath.absolutePath, null, android.database.sqlite.SQLiteDatabase.OPEN_READWRITE)
              val logMsg = "Boot receiver restored $futureAlarmsRestored future alarms"
              db.execSQL("INSERT INTO background_task_logs (timestamp, category, message) VALUES (?, ?, ?)", arrayOf(System.currentTimeMillis(), "reminder", logMsg))
              db.close()
          }
      } catch (dbE: Exception) {
          Log.e("TouchGrass", "Error writing native activity log", dbE)
      }

      // Conditional Wake
      if (futureAlarmsRestored == 0) {
          Log.d("TouchGrass", "[SR_BOOT_RESTORE] Chain broken. Waking JS for replan.")
          val headlessIntent = Intent(context, SmartReminderHeadlessService::class.java).apply {
              putExtra("type", "boot_replan")
          }
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              context.startForegroundService(headlessIntent)
          } else {
              context.startService(headlessIntent)
          }
      }
    } catch (e: Exception) {
        Log.e("TouchGrass", "Error restoring alarms on boot", e)
    }
  }
}
`;

const ACTIVITY_TRANSITION_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

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
        'SmartReminderHeadlessService.kt': SMART_REMINDER_HEADLESS_SERVICE_KT,
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
      const fullName = `${JAVA_PACKAGE}.${name}`;
      if (!application.receiver.some((r) => r.$?.['android:name'] === fullName)) {
        const receiverObj = { $: { 'android:name': fullName, 'android:exported': exported } };
        if (intentFilters) receiverObj['intent-filter'] = intentFilters;
        application.receiver.push(receiverObj);
      }
    };

    const addService = (name, exported, foregroundServiceType = null) => {
      const fullName = `${JAVA_PACKAGE}.${name}`;
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

    addService('SmartReminderHeadlessService', 'false', 'shortService');
    addService('ActivityTransitionHeadlessService', 'false', 'shortService');

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
