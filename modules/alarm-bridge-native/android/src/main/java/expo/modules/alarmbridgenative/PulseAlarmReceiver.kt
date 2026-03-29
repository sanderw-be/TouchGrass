package expo.modules.alarmbridgenative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Receives the exact pulse alarm (ACTION_PULSE) fired by AlarmManager and
 * starts the AlarmPulseService foreground service, which in turn executes
 * the HeadlessJS "PulseTask".
 *
 * The receiver is declared with android:exported="false" in the manifest so
 * only alarms created by this app's own PendingIntent can trigger it.
 */
class PulseAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmBridgeNativeModule.ACTION_PULSE) return
        ContextCompat.startForegroundService(
            context,
            Intent(context, AlarmPulseService::class.java),
        )
    }
}
