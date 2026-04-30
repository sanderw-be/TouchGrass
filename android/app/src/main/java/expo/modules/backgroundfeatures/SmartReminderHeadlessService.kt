package expo.modules.backgroundfeatures

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class SmartReminderHeadlessService : HeadlessJsTaskService() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ensureNotificationChannel()
            val notification = buildSilentNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }
    }

    private fun ensureNotificationChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Background tasks",
                    NotificationManager.IMPORTANCE_MIN
                ).apply { setShowBadge(false) }
                nm.createNotificationChannel(channel)
            }
        }
    }

    private fun buildSilentNotification(): android.app.Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TouchGrass background task")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setShowWhen(false)
            .build()
    }

    protected override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val data = Arguments.createMap()
        intent?.extras?.let { extras ->
            for (key in extras.keySet()) {
                val value = extras.get(key)
                if (value is String) data.putString(key, value)
                else if (value is Int) data.putInt(key, value)
                else if (value is Double) data.putDouble(key, value)
                else if (value is Boolean) data.putBoolean(key, value)
            }
        }
        return HeadlessJsTaskConfig(
            "SmartReminderHeadlessTask",
            data,
            10000L,
            true
        )
    }

    override fun onHeadlessJsTaskFinish(taskId: Int) {
        super.onHeadlessJsTaskFinish(taskId)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val NOTIFICATION_ID = 0x1001
        private const val CHANNEL_ID = "touchgrass_headless_bg"
    }
}
