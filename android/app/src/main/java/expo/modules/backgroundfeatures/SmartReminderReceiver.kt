package expo.modules.backgroundfeatures

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

class SmartReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      val type = intent.getStringExtra("type") ?: "Reminder"
      Log.d("TouchGrass", "[SR_RECEIVER] broadcastreceiver for notification called (type=$type)")
      
      Log.d("TouchGrass", "[SR_RECEIVER] Starting headless service.")
      val headlessIntent = Intent(context, SmartReminderHeadlessService::class.java).apply {
          intent.extras?.let { putExtras(it) }
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(headlessIntent)
      } else {
          context.startService(headlessIntent)
      }

    } catch (e: Exception) {
      Log.e("TouchGrass", "[SR_RECEIVER] Error in onReceive", e)
    }
  }
}
