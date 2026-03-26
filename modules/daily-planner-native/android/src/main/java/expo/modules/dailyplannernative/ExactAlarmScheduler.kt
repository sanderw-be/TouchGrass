package expo.modules.dailyplannernative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * Schedules exact alarms via [AlarmManager.setExactAndAllowWhileIdle].
 * Each alarm is identified by an integer [requestCode] so it can be cancelled
 * later.  When the alarm fires, [ExactAlarmReceiver] starts the
 * [DailyPlannerHeadlessService] to execute JS‑side logic.
 */
object ExactAlarmScheduler {

  private const val TAG = "ExactAlarmScheduler"

  /**
   * Schedule an exact alarm for [hour]:[minute] today (or tomorrow if that
   * time has already passed).  Returns `true` if the alarm was set.
   */
  fun scheduleExact(context: Context, requestCode: Int, hour: Int, minute: Int): Boolean {
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false

    // On Android 12+ check the exact‑alarm permission
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
      Log.w(TAG, "Exact alarms not permitted; falling back to inexact")
      return false
    }

    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (before(Calendar.getInstance())) {
        add(Calendar.DAY_OF_MONTH, 1)
      }
    }

    val pi = buildPendingIntent(context, requestCode)
    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pi)
    Log.i(TAG, "Exact alarm scheduled: id=$requestCode at $hour:${minute.toString().padStart(2, '0')}")
    return true
  }

  /**
   * Cancel a previously scheduled alarm identified by [requestCode].
   */
  fun cancel(context: Context, requestCode: Int) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    am.cancel(buildPendingIntent(context, requestCode))
    Log.i(TAG, "Exact alarm cancelled: id=$requestCode")
  }

  private fun buildPendingIntent(context: Context, requestCode: Int): PendingIntent {
    val intent = Intent(context, ExactAlarmReceiver::class.java)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}

/**
 * Receives exact‑alarm broadcasts and delegates to the headless JS service.
 */
class ExactAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    Log.i("ExactAlarmReceiver", "Alarm fired, starting headless service")
    DailyPlannerHeadlessService.start(context)
  }
}
