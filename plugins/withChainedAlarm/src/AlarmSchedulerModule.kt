package com.jollyheron.touchgrass

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmSchedulerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AlarmScheduler"

    @ReactMethod
    fun scheduleNextAlarm(timestampMs: Double) {
        val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(reactApplicationContext, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            reactApplicationContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestampMs.toLong(), pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestampMs.toLong(), pendingIntent)
        }
    }
}
