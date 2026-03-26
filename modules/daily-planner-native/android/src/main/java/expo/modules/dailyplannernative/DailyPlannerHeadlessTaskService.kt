package expo.modules.dailyplannernative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class DailyPlannerHeadlessTaskService : HeadlessJsTaskService() {

    companion object {
        private const val TAG = "DailyPlannerHeadless"
        private const val CHANNEL_ID = "touchgrass_daily_planner"
        private const val NOTIF_ID = 9001
    }

    override fun onCreate() {
        super.onCreate()
        // Android O+ requires a foreground notification for services started from background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Daily Planner",
                NotificationManager.IMPORTANCE_MIN
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)

            val notification = Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("TouchGrass")
                .setContentText("Planning smart reminders…")
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .build()
            startForeground(NOTIF_ID, notification)
        }
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        Log.i(TAG, "Returning HeadlessJsTaskConfig for DailyPlannerTask")
        return HeadlessJsTaskConfig(
            DailyPlannerNativeModule.HEADLESS_TASK_NAME,
            Arguments.createMap(),
            30000L, // timeout in ms — allow time for DB queries + notification scheduling
            true   // allow task to run in foreground
        )
    }
}
