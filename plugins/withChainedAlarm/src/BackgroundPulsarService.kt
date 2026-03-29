package com.jollyheron.touchgrass

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService

class BackgroundPulsarService : Service() {
    private val CHANNEL_ID = "pulsar-channel"

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        // 1. Immediately start foreground with a notification
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Updating Schedule")
            .setSmallIcon(R.mipmap.ic_launcher)
            .build()

        // Critical: Must specify shortService type in startForeground
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(101, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
        } else {
            startForeground(101, notification)
        }

        // 2. Start the React Native HeadlessJS Task
        val bundle = Bundle()
        val headlessIntent = Intent(this, ReminderHeadlessTaskService::class.java)
        headlessIntent.putExtras(bundle)
        this.startService(headlessIntent)
        HeadlessJsTaskService.acquireWakeLockNow(this)

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Background Pulsar",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }
}
