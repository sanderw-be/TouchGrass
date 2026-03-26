package expo.modules.dailyplannernative

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Android Service that boots the React Native engine (when the app is killed)
 * and runs the JS HeadlessJS task registered as "DailyPlannerTask".
 *
 * This is invoked by [DailyPlannerWorker] at ~03:00 and by [BootReceiver]
 * after a device reboot.
 */
class DailyPlannerHeadlessService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig {
    val extras = intent.extras ?: Bundle()
    return HeadlessJsTaskConfig(
      TASK_NAME,
      Arguments.fromBundle(extras),
      TASK_TIMEOUT_MS,
      true, // allow task to run in foreground
    )
  }

  companion object {
    const val TASK_NAME = "DailyPlannerTask"
    private const val TASK_TIMEOUT_MS: Long = 60_000 // 60 seconds
    private const val TAG = "DailyPlannerHeadless"

    /**
     * Start this headless service from any context (Worker, BroadcastReceiver, etc.).
     */
    fun start(context: Context) {
      val intent = Intent(context, DailyPlannerHeadlessService::class.java)
      try {
        context.startService(intent)
        Log.i(TAG, "Headless service started")
      } catch (e: Exception) {
        Log.w(TAG, "Could not start headless service (app may be in background restriction)", e)
      }
    }
  }
}
