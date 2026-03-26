package expo.modules.dailyplannernative

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class DailyPlannerWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "DailyPlannerWorker"
    }

    override suspend fun doWork(): Result {
        Log.i(TAG, "Daily planner worker fired – starting HeadlessJS task service")
        try {
            val intent = Intent(applicationContext, DailyPlannerHeadlessTaskService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(intent)
            } else {
                applicationContext.startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HeadlessJS task service", e)
            return Result.failure()
        }
        return Result.success()
    }
}
