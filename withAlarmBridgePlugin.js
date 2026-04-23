'use strict';

const {
  withDangerousMod,
  withAndroidManifest,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Kotlin source files — written to android/app/src/main/java/... at prebuild
// ---------------------------------------------------------------------------

const JAVA_PACKAGE = 'expo.modules.alarmbridgenative';
const JAVA_SUBPATH = JAVA_PACKAGE.split('.').join('/');

const ALARM_BRIDGE_MODULE_KT = `\
package ${JAVA_PACKAGE}

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * React Native native module that schedules exact alarms via AlarmManager.
 *
 * setExactAndAllowWhileIdle bypasses Doze mode and is not subject to
 * WorkManager's periodic-task quota — the root cause of the stale
 * TOUCHGRASS_UNIFIED_TASK bug after ~12 h of no user interaction.
 */
class AlarmBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AlarmBridgeNative"

  @ReactMethod
  fun scheduleNextPulse(delayMs: Double, promise: Promise) {
    try {
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pendingIntent = buildPulseIntent(reactContext)
      val triggerAtMs = SystemClock.elapsedRealtime() + delayMs.toLong()
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.ELAPSED_REALTIME_WAKEUP,
        triggerAtMs,
        pendingIntent,
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ALARM_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun cancelPulse(promise: Promise) {
    try {
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val existing = PendingIntent.getBroadcast(
        reactContext,
        REQUEST_CODE_PULSE,
        pulseIntent(reactContext),
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
      )
      existing?.let { alarmManager.cancel(it) }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ALARM_ERROR", e.message, e)
    }
  }

  companion object {
    private const val REQUEST_CODE_PULSE = 0xAB12

    private fun pulseIntent(context: Context): Intent =
      Intent(context, PulseAlarmReceiver::class.java).apply {
        action = "expo.modules.alarmbridgenative.PULSE"
        \`package\` = context.packageName
      }

    fun buildPulseIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        REQUEST_CODE_PULSE,
        pulseIntent(context),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
  }
}
`;

const ALARM_BRIDGE_PACKAGE_KT = `\
package ${JAVA_PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AlarmBridgePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(AlarmBridgeModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

const PULSE_ALARM_RECEIVER_KT = `\
package ${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/**
 * BroadcastReceiver that wakes up when the AlarmManager fires the Pulsar alarm.
 * Acquires a wake lock and starts AlarmPulseService to run the JS headless task.
 */
class PulseAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    HeadlessJsTaskService.acquireWakeLockNow(context)
    AlarmPulseService.start(context)
  }
}
`;

const ALARM_PULSE_SERVICE_KT = `\
package ${JAVA_PACKAGE}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * HeadlessJsTaskService that runs the TOUCHGRASS_PULSE_TASK JS headless task.
 *
 * Started by PulseAlarmReceiver when the Pulsar alarm fires.
 * Runs as a short foreground service (Android O+) so the OS cannot kill it before
 * the JS task finishes scheduling the next alarm.
 */
class AlarmPulseService : HeadlessJsTaskService() {

  override fun onCreate() {
    super.onCreate()
    // Android O+ requires startForeground() within 5 s of startForegroundService().
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ensureNotificationChannel()
      val notification = buildSilentNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE,
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    }
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? =
    HeadlessJsTaskConfig(
      PULSE_TASK_NAME,
      Arguments.createMap(),
      PULSE_TASK_TIMEOUT_MS,
      /* allowedInForeground= */ true,
    )

  override fun onHeadlessJsTaskFinish(taskId: Int) {
    super.onHeadlessJsTaskFinish(taskId)
    stopForeground(Service.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun ensureNotificationChannel() {
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Background activity",
        NotificationManager.IMPORTANCE_MIN,
      ).apply { setShowBadge(false) }
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildSilentNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("TouchGrass")
      .setSmallIcon(android.R.drawable.ic_popup_sync)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setShowWhen(false)
      .build()

  companion object {
    const val PULSE_TASK_NAME = "TOUCHGRASS_PULSE_TASK"
    private const val PULSE_TASK_TIMEOUT_MS = 30_000L
    private const val NOTIFICATION_ID = 0xAB13
    private const val CHANNEL_ID = "touchgrass_pulse_bg"

    fun start(context: Context) {
      val intent = Intent(context, AlarmPulseService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
`;

// ---------------------------------------------------------------------------
// Config plugin
// ---------------------------------------------------------------------------

/**
 * Config plugin that:
 * 1. Writes Pulsar alarm-bridge Kotlin source files into the Android app module
 *    at prebuild time via withDangerousMod.
 * 2. Registers AlarmBridgePackage in MainApplication via withMainApplication.
 * 3. Adds PulseAlarmReceiver and AlarmPulseService to AndroidManifest.xml via
 *    withAndroidManifest.
 *
 * Together these replace the WorkManager-based TOUCHGRASS_UNIFIED_TASK which
 * goes stale after ~12 h because Android cancels its JS body mid-execution.
 */
const withAlarmBridgePlugin = (config) => {
  // ---- 1. Write Kotlin source files ----------------------------------------
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
        'AlarmBridgeModule.kt': ALARM_BRIDGE_MODULE_KT,
        'AlarmBridgePackage.kt': ALARM_BRIDGE_PACKAGE_KT,
        'PulseAlarmReceiver.kt': PULSE_ALARM_RECEIVER_KT,
        'AlarmPulseService.kt': ALARM_PULSE_SERVICE_KT,
      };

      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(javaDir, filename), content, 'utf8');
      }

      return config;
    },
  ]);

  // ---- 2. Register the ReactPackage in MainApplication ---------------------
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Skip if already patched
    if (contents.includes('AlarmBridgePackage')) return config;

    // Insert the new import after the last existing import line so the
    // import block stays together (more robust than inserting before the first).
    const lines = contents.split('\n');
    const lastImportIdx = lines.reduce(
      (max, line, i) => (line.trimStart().startsWith('import ') ? i : max),
      -1
    );
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, `import ${JAVA_PACKAGE}.AlarmBridgePackage`);
    } else {
      // No existing imports (edge case) — add after the package declaration
      const pkgIdx = lines.findIndex((l) => l.trimStart().startsWith('package '));
      lines.splice(pkgIdx >= 0 ? pkgIdx + 2 : 0, 0, `import ${JAVA_PACKAGE}.AlarmBridgePackage`);
    }
    contents = lines.join('\n');

    // Insert add(AlarmBridgePackage()) inside the PackageList apply block.
    // The generated MainApplication.kt always has this comment placeholder.
    contents = contents.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{)/,
      `$1\n              add(AlarmBridgePackage())`
    );

    config.modResults.contents = contents;
    return config;
  });

  // ---- 3. Update AndroidManifest.xml ----------------------------------------
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    application.receiver = application.receiver ?? [];
    application.service = application.service ?? [];

    // PulseAlarmReceiver — triggered by the exact alarm
    const PULSE_RECEIVER = `${JAVA_PACKAGE}.PulseAlarmReceiver`;
    if (!application.receiver.some((r) => r.$?.['android:name'] === PULSE_RECEIVER)) {
      application.receiver.push({
        $: { 'android:name': PULSE_RECEIVER, 'android:exported': 'false' },
      });
    }

    // AlarmPulseService — HeadlessJsTaskService; shortService type on API 34+
    const PULSE_SERVICE = `${JAVA_PACKAGE}.AlarmPulseService`;
    if (!application.service.some((s) => s.$?.['android:name'] === PULSE_SERVICE)) {
      application.service.push({
        $: {
          'android:name': PULSE_SERVICE,
          'android:exported': 'false',
          'android:foregroundServiceType': 'shortService',
        },
      });
    }

    return config;
  });

  return config;
};

module.exports = withAlarmBridgePlugin;
