package expo.modules.alarmbridgenative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Foreground HeadlessJS service that executes the JS "PulseTask" when an
 * exact AlarmManager pulse fires (see PulseAlarmReceiver).
 *
 * - Declared as foregroundServiceType="shortService" in the manifest so it
 *   has no cumulative quota (just a ~3-minute per-run hard limit).
 * - Shows a silent low-priority notification as required by Android 8+.
 * - HeadlessJsTaskService initialises a React Native JS context and runs the
 *   registered PulseTask, which performs reminder scheduling and chains the
 *   next alarm before completing.
 */
class AlarmPulseService : HeadlessJsTaskService() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Must call startForeground() before super so the service is promoted to
        // foreground within the 10-second window imposed by Android 8+.
        ensureNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return super.onStartCommand(intent, flags, startId)
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        // "PulseTask" must match the name registered via
        // AppRegistry.registerHeadlessTask in index.ts.
        // timeout = 30 s (well within shortService's ~3-minute limit).
        // allowedInForeground = true so the task also runs when the UI is active.
        return HeadlessJsTaskConfig(HEADLESS_TASK_NAME, Arguments.createMap(), 30_000L, true)
    }

    private fun ensureNotificationChannel() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TouchGrass Background",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Silent channel for background reminder checks"
                setShowBadge(false)
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val iconRes = resources.getIdentifier("ic_launcher", "mipmap", packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_popup_reminder

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("TouchGrass")
            .setContentText("Checking reminders…")
            .setSmallIcon(iconRes)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val HEADLESS_TASK_NAME = "PulseTask"
        // Unique notification ID for the AlarmPulseService foreground notification.
        // Chosen to be distinct from expo-notifications IDs (which start at 1) and
        // from the react-native-background-actions service (which uses its own ID).
        private const val NOTIFICATION_ID = 1_001
        private const val CHANNEL_ID = "touchgrass_pulse"
    }
}
