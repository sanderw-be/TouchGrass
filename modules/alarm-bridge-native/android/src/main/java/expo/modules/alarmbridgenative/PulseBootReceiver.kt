package expo.modules.alarmbridgenative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-initiates the alarm chain after a device reboot.
 *
 * When the device boots, any previously scheduled AlarmManager alarms are
 * wiped by the OS.  This receiver reads the last-persisted pulse timestamp
 * from SharedPreferences and reschedules it.  If that time is already in the
 * past (the device was off when it should have fired), it schedules a pulse
 * one minute from now so the reminder chain restarts immediately.
 *
 * Requires android:exported="true" because the BOOT_COMPLETED broadcast is
 * sent by the Android system (outside this app's process).
 */
class PulseBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = context.getSharedPreferences(
            AlarmBridgeNativeModule.PREFS_NAME,
            Context.MODE_PRIVATE,
        )
        val savedMs = prefs.getLong(AlarmBridgeNativeModule.KEY_NEXT_PULSE_MS, 0L)

        // If the saved time is still in the future, honour it exactly.
        // Otherwise start the chain 1 minute from now to avoid a burst of
        // catch-up work right after boot.
        val triggerMs = if (savedMs > System.currentTimeMillis()) {
            savedMs
        } else {
            System.currentTimeMillis() + 60_000L
        }

        AlarmBridgeNativeModule.scheduleAlarm(context, triggerMs)
    }
}
