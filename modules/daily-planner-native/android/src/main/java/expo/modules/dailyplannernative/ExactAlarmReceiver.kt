package expo.modules.dailyplannernative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives exact alarm broadcasts and starts the HeadlessJS task service.
 */
class ExactAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ExactAlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.i(TAG, "Exact alarm fired – starting HeadlessJS task service")
        val serviceIntent = Intent(context, DailyPlannerHeadlessTaskService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
