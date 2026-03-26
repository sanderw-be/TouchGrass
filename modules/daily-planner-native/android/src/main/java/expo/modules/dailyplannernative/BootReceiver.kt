package expo.modules.dailyplannernative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives [Intent.ACTION_BOOT_COMPLETED] after the device restarts.
 *
 * Re-enqueues the daily 3 AM WorkManager job and starts the headless JS
 * service so that any reminders missed during the reboot window are
 * immediately re-planned.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

    Log.i(TAG, "Device rebooted — rescheduling daily planner WorkManager job")
    try {
      DailyPlannerNativeModule.scheduleDailyWork(context)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to reschedule WorkManager job after boot", e)
    }

    Log.i(TAG, "Running headless task to re-plan reminders after reboot")
    try {
      DailyPlannerHeadlessService.start(context)
    } catch (e: Exception) {
      Log.w(TAG, "Could not start headless service after boot", e)
    }
  }

  companion object {
    private const val TAG = "BootReceiver"
  }
}
