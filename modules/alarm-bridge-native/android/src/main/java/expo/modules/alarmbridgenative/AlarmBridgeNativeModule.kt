package expo.modules.alarmbridgenative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlarmBridgeNativeModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("AlarmBridgeNative")

        // Schedule an exact alarm that will fire at the given epoch timestamp (ms).
        // Uses setExactAndAllowWhileIdle so the alarm fires even during Doze mode.
        Function("scheduleNextPulse") { timestampMs: Double ->
            val context = appContext.reactContext ?: return@Function
            scheduleAlarm(context, timestampMs.toLong())
        }
    }

    companion object {
        const val PREFS_NAME = "AlarmBridgePrefs"
        const val KEY_NEXT_PULSE_MS = "next_pulse_ms"
        const val ACTION_PULSE = "expo.modules.alarmbridgenative.ACTION_PULSE"

        /**
         * Schedule (or re-schedule) the exact pulse alarm.
         * Also persists the trigger time in SharedPreferences so PulseBootReceiver
         * can restore the alarm chain after a device reboot.
         */
        fun scheduleAlarm(context: Context, triggerAtMs: Long) {
            context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_NEXT_PULSE_MS, triggerAtMs)
                .apply()

            val intent = Intent(ACTION_PULSE).apply {
                // Restrict delivery to this app so the broadcast cannot be
                // intercepted by other apps.
                setPackage(context.packageName)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val alarmManager =
                context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMs,
                pendingIntent,
            )
        }
    }
}
