package expo.modules.dailyplannernative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.concurrent.TimeUnit

class DailyPlannerNativeModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("DailyPlannerNative")

    /**
     * Schedule a daily WorkManager task that fires at approximately 3:00 AM.
     * WorkManager persists across app restarts and device reboots.
     */
    AsyncFunction("scheduleDailyPlanner") {
      val context = appContext.reactContext ?: return@AsyncFunction
      scheduleDailyWork(context)
    }

    /**
     * Cancel the daily WorkManager task.
     */
    AsyncFunction("cancelDailyPlanner") {
      val context = appContext.reactContext ?: return@AsyncFunction
      WorkManager.getInstance(context)
        .cancelUniqueWork(DailyPlannerWorker.WORK_NAME)
    }

    /**
     * Schedule an exact alarm at a specific hour and minute using AlarmManager.
     * Returns true if the alarm was scheduled, false otherwise.
     */
    AsyncFunction("scheduleExactAlarm") { id: Int, hour: Int, minute: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ExactAlarmScheduler.scheduleExact(context, id, hour, minute)
    }

    /**
     * Cancel an exact alarm by its ID.
     */
    AsyncFunction("cancelExactAlarm") { id: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction
      ExactAlarmScheduler.cancel(context, id)
    }

    /**
     * Check whether the app is exempt from battery optimizations.
     */
    Function("isBatteryOptimizationIgnored") {
      val context = appContext.reactContext ?: return@Function false
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        ?: return@Function false
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Open the system screen where the user can exempt this app from battery
     * optimizations (doze/app standby).
     */
    Function("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }
  }

  companion object {
    /**
     * Schedule the daily WorkManager job.  Calculates the initial delay so that
     * the first execution lands at approximately 03:00 local time, then repeats
     * every 24 hours.
     */
    fun scheduleDailyWork(context: Context) {
      val now = Calendar.getInstance()
      val target = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 3)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (before(now)) {
          add(Calendar.DAY_OF_MONTH, 1)
        }
      }
      val initialDelayMs = target.timeInMillis - now.timeInMillis

      val request = PeriodicWorkRequestBuilder<DailyPlannerWorker>(
        24, TimeUnit.HOURS,
      )
        .setInitialDelay(initialDelayMs, TimeUnit.MILLISECONDS)
        .build()

      WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(
          DailyPlannerWorker.WORK_NAME,
          ExistingPeriodicWorkPolicy.UPDATE,
          request,
        )
    }
  }
}
