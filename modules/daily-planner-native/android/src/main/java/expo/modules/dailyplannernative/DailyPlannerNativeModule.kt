package expo.modules.dailyplannernative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.work.WorkManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class DailyPlannerNativeModule : Module() {

    companion object {
        const val WORK_NAME = "daily_planner_work"
        const val HEADLESS_TASK_NAME = "DailyPlannerTask"
        const val TARGET_HOUR = 3
        const val TARGET_MINUTE = 0
    }

    override fun definition() = ModuleDefinition {
        Name("DailyPlannerNative")

        AsyncFunction("scheduleDailyPlanner") {
            val context = appContext.reactContext ?: throw Exception("React context is null")
            DailyPlannerScheduler.schedule(context)
        }

        AsyncFunction("cancelDailyPlanner") {
            val context = appContext.reactContext ?: throw Exception("React context is null")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        AsyncFunction("scheduleExactAlarm") { hour: Int, minute: Int ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            scheduleExact(context, hour, minute)
        }

        AsyncFunction("requestIgnoreBatteryOptimizations") {
            val context = appContext.reactContext ?: throw Exception("React context is null")
            requestBatteryOptimizationExemption(context)
        }
    }

    private fun scheduleExact(context: Context, hour: Int, minute: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            throw Exception("Exact alarm permission not granted")
        }

        val intent = Intent(context, ExactAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (before(now)) add(Calendar.DAY_OF_MONTH, 1)
        }

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            target.timeInMillis,
            pendingIntent
        )
    }

    private fun requestBatteryOptimizationExemption(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
            return true
        }
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return false
    }
}
