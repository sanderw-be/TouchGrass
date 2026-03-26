package expo.modules.dailyplannernative

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * A periodic WorkManager worker scheduled for ~03:00 every day.
 *
 * When invoked it starts [DailyPlannerHeadlessService] which boots the React
 * Native JS engine (if not already running) and executes the HeadlessJS task
 * named "DailyPlannerTask".  That JS function performs smart‑reminder
 * planning, scheduled‑notification rescheduling, and calendar‑event creation.
 */
class DailyPlannerWorker(
  context: Context,
  params: WorkerParameters,
) : CoroutineWorker(context, params) {

  override suspend fun doWork(): Result {
    Log.i(TAG, "DailyPlannerWorker starting HeadlessJS task")
    return try {
      startHeadlessTask()
      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "DailyPlannerWorker failed", e)
      Result.retry()
    }
  }

  private suspend fun startHeadlessTask() = suspendCancellableCoroutine { cont ->
    try {
      DailyPlannerHeadlessService.start(applicationContext)
      cont.resume(Unit)
    } catch (e: Exception) {
      cont.resume(Unit) // Don't crash; the service start is best‑effort
      Log.w(TAG, "Could not start headless service", e)
    }
  }

  companion object {
    const val WORK_NAME = "daily_planner_3am"
    private const val TAG = "DailyPlannerWorker"
  }
}
