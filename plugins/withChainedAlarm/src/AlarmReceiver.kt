package com.jollyheron.touchgrass

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val serviceIntent = Intent(context, BackgroundPulsarService::class.java)
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
