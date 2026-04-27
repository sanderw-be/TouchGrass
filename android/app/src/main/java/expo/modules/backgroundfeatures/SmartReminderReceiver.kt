package expo.modules.backgroundfeatures

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

class SmartReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      val type = intent.getStringExtra("type") ?: "smart_reminder"
      Log.d("TouchGrass", "[SR_RECEIVER] Starting Headless Service for type=$type")
      
      val headlessIntent = Intent(context, SmartReminderHeadlessService::class.java).apply {
          putExtra("type", type)
      }
      
      // Android 8+ requirement: startForegroundService
      ContextCompat.startForegroundService(context, headlessIntent)

    } catch (e: Exception) {
      Log.e("TouchGrass", "[SR_RECEIVER] Error in onReceive", e)
    }
  }
}
