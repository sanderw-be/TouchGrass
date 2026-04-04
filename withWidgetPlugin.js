/**
 * Expo config plugin to add Android home screen widget support.
 *
 * Injects the widget provider, layout, and drawable resources into the
 * native Android project during `npx expo prebuild`.
 *
 * Key fix: the widget communicates with the app via a deep link URI
 * (touchgrass://widget?startTimer=true) so that React Native's Linking
 * API can detect it. Plain Intent extras are invisible to JS.
 */

'use strict';

const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Add widget receiver to AndroidManifest.xml
// ---------------------------------------------------------------------------
function withWidgetReceiver(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application?.[0];

    if (!application) {
      throw new Error('AndroidManifest.xml is missing application element');
    }

    application.receiver = application.receiver ?? [];

    const widgetReceiverExists = application.receiver.some(
      (receiver) => receiver.$?.['android:name'] === '.ProgressWidgetProvider'
    );

    if (!widgetReceiverExists) {
      application.receiver.push({
        $: {
          'android:name': '.ProgressWidgetProvider',
          'android:exported': 'true',
          'android:label': 'TouchGrass Progress',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/widget_info',
            },
          },
        ],
      });
    }

    return config;
  });
}

// ---------------------------------------------------------------------------
// 2. Add widget description string to strings.xml
// ---------------------------------------------------------------------------
function withWidgetStrings(config) {
  return withStringsXml(config, async (config) => {
    const strings = config.modResults;

    const widgetDescExists = strings.resources.string?.some(
      (str) => str.$.name === 'widget_description'
    );

    if (!widgetDescExists) {
      strings.resources.string = strings.resources.string ?? [];
      strings.resources.string.push({
        $: { name: 'widget_description' },
        _: 'Shows your daily outdoor progress and lets you start a timer',
      });
    }

    return config;
  });
}

// ---------------------------------------------------------------------------
// 3. Write native source files into the android/ directory
// ---------------------------------------------------------------------------
function withWidgetSourceFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidDir = path.join(projectRoot, 'android');

      if (!fs.existsSync(androidDir)) return config;

      const packagePath = path.join(androidDir, 'app/src/main/java/com/jollyheron/touchgrass');
      const resPath = path.join(androidDir, 'app/src/main/res');

      // ProgressWidgetProvider.kt
      fs.mkdirSync(packagePath, { recursive: true });
      fs.writeFileSync(path.join(packagePath, 'ProgressWidgetProvider.kt'), WIDGET_PROVIDER_KT);

      // Layout XML
      const layoutDir = path.join(resPath, 'layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.writeFileSync(path.join(layoutDir, 'widget_progress.xml'), WIDGET_LAYOUT_XML);

      // Widget info XML
      const xmlDir = path.join(resPath, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'widget_info.xml'), WIDGET_INFO_XML);

      // Drawables
      const drawableDir = path.join(resPath, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });

      const drawables = {
        widget_background: WIDGET_BACKGROUND_XML,
        widget_button_background: WIDGET_BUTTON_BG_XML,
        widget_play_icon: WIDGET_PLAY_ICON_XML,
        widget_stop_icon: WIDGET_STOP_ICON_XML,
        widget_preview: WIDGET_PREVIEW_XML,
        widget_ring_low: ringXml('low', '#7EB8D4'),
        widget_ring_medium: ringXml('medium', '#F5C842'),
        widget_ring_good: ringXml('good', '#4A7C59'),
        widget_ring_complete: ringXml('complete', '#6BAF7A'),
      };

      for (const [name, content] of Object.entries(drawables)) {
        fs.writeFileSync(path.join(drawableDir, `${name}.xml`), content);
      }

      return config;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Kotlin: ProgressWidgetProvider
//
// Reads data from the expo-sqlite database and renders a RemoteViews widget.
//
// DB schema (from src/storage/database.ts):
//   Table: outside_sessions  — startTime/endTime (epoch ms), durationMinutes (REAL), userConfirmed (1/0/null)
//   Table: daily_goals       — targetMinutes (INT), createdAt (epoch ms)
//   Table: app_settings      — key TEXT PK, value TEXT
//
// Timer: tapping play/stop writes a marker (widget_timer_start) into
// app_settings and inserts a completed session on stop — no app launch needed.
// ---------------------------------------------------------------------------
const WIDGET_PROVIDER_KT = `\
package com.jollyheron.touchgrass

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.widget.RemoteViews
import java.util.*

class ProgressWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "TouchGrassWidget"
        private const val ACTION_TOGGLE_TIMER = "com.jollyheron.touchgrass.WIDGET_TOGGLE_TIMER"
        private const val TIMER_KEY = "widget_timer_start"
    }

    // Called by the system every updatePeriodMillis and on first add.
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) refreshWidget(context, appWidgetManager, id)
    }

    // Handle our custom "toggle timer" broadcast.
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE_TIMER) {
            toggleTimer(context)
            // Refresh all widget instances so the icon updates.
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, ProgressWidgetProvider::class.java))
            for (id in ids) refreshWidget(context, mgr, id)
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    private fun refreshWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_progress)
        val data = readWidgetData(context)
        val timerRunning = isTimerRunning(context)

        // Progress text — show rounded minutes
        val displayCurrent = Math.round(data.current).toInt()
        views.setTextViewText(R.id.widget_progress_text, "\$displayCurrent / \${data.target} min")

        // Ring colour
        val pct = if (data.target > 0) (data.current / data.target * 100).toInt() else 0
        val ringRes = when {
            pct >= 100 -> R.drawable.widget_ring_complete
            pct >= 60  -> R.drawable.widget_ring_good
            pct >= 30  -> R.drawable.widget_ring_medium
            else       -> R.drawable.widget_ring_low
        }
        views.setImageViewResource(R.id.widget_progress_ring, ringRes)

        // Play / Stop icon
        views.setImageViewResource(
            R.id.widget_button_icon,
            if (timerRunning) R.drawable.widget_stop_icon else R.drawable.widget_play_icon
        )

        // Toggle-timer broadcast on button tap
        val toggleIntent = Intent(context, ProgressWidgetProvider::class.java).apply {
            action = ACTION_TOGGLE_TIMER
        }
        val togglePending = PendingIntent.getBroadcast(
            context, 0, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_start_button, togglePending)

        // Tap the ring area → open app via deep link (optionally with timer context)
        val uri = if (timerRunning) "touchgrass://widget?timerRunning=true"
                  else "touchgrass://home"
        val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
            setClassName(context, "com.jollyheron.touchgrass.MainActivity")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            context, widgetId + 10000, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, openPending)

        mgr.updateAppWidget(widgetId, views)
    }

    // -----------------------------------------------------------------------
    // Timer toggle — writes directly into the app_settings / outside_sessions
    // tables so no app launch is required.
    // -----------------------------------------------------------------------
    private fun toggleTimer(context: Context) {
        try {
            val db = openDb(context, writable = true) ?: return
            try {
                val running = getTimerStart(db)
                if (running != null) {
                    // --- Stop: insert session & clear marker -----------------
                    val now = System.currentTimeMillis()
                    val durationMin = (now - running).toFloat() / 60_000f
                    db.execSQL(
                        """INSERT INTO outside_sessions
                           (startTime, endTime, durationMinutes, source, confidence, userConfirmed, discarded)
                           VALUES (?, ?, ?, 'manual', 1.0, 1, 0)""",
                        arrayOf(running, now, durationMin)
                    )
                    db.delete("app_settings", "key = ?", arrayOf(TIMER_KEY))
                    android.util.Log.d(TAG, "Timer stopped — session \${durationMin.toInt()} min")
                } else {
                    // --- Start: write marker ---------------------------------
                    val cv = ContentValues().apply {
                        put("key", TIMER_KEY)
                        put("value", System.currentTimeMillis().toString())
                    }
                    db.insertWithOnConflict("app_settings", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
                    android.util.Log.d(TAG, "Timer started")
                }
            } finally {
                db.close()
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "toggleTimer error", e)
        }
    }

    // -----------------------------------------------------------------------
    // DB helpers
    // -----------------------------------------------------------------------
    private fun openDb(context: Context, writable: Boolean = false): SQLiteDatabase? {
        val dbFile = context.getDatabasePath("touchgrass.db")
        if (!dbFile.exists()) {
            android.util.Log.w(TAG, "DB not found at \${dbFile.absolutePath}")
            return null
        }
        val flags = if (writable) SQLiteDatabase.OPEN_READWRITE else SQLiteDatabase.OPEN_READONLY
        return SQLiteDatabase.openDatabase(dbFile.absolutePath, null, flags)
    }

    private fun isTimerRunning(context: Context): Boolean {
        val db = openDb(context) ?: return false
        try {
            return getTimerStart(db) != null
        } finally {
            db.close()
        }
    }

    private fun getTimerStart(db: SQLiteDatabase): Long? {
        db.rawQuery(
            "SELECT value FROM app_settings WHERE key = ?", arrayOf(TIMER_KEY)
        ).use { c ->
            if (c.moveToFirst()) return c.getString(0).toLongOrNull()
        }
        return null
    }

    private fun readWidgetData(context: Context): WidgetData {
        val db = openDb(context) ?: return WidgetData(0f, 30)
        try {
            val current = getTodayMinutes(db)
            val target  = getDailyGoal(db)
            return WidgetData(current, target)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "readWidgetData error", e)
            return WidgetData(0f, 30)
        } finally {
            db.close()
        }
    }

    /**
     * Sum of confirmed session minutes for today.
     * startTime is stored as epoch-ms; we compare against start-of-day.
     */
    private fun getTodayMinutes(db: SQLiteDatabase): Float {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val startOfDay = cal.timeInMillis
        val endOfDay   = startOfDay + 86_400_000L

        db.rawQuery(
            """SELECT COALESCE(SUM(durationMinutes), 0)
               FROM outside_sessions
               WHERE startTime >= ? AND startTime < ? AND userConfirmed = 1""",
            arrayOf(startOfDay.toString(), endOfDay.toString())
        ).use { c ->
            if (c.moveToFirst()) return c.getFloat(0)
        }
        return 0f
    }

    /** Latest daily goal from daily_goals table (most recent by createdAt). */
    private fun getDailyGoal(db: SQLiteDatabase): Int {
        db.rawQuery(
            "SELECT targetMinutes FROM daily_goals ORDER BY createdAt DESC LIMIT 1", null
        ).use { c ->
            if (c.moveToFirst()) return c.getInt(0)
        }
        return 30
    }
}

data class WidgetData(val current: Float, val target: Int)
`;

// ---------------------------------------------------------------------------
// Layout: widget_progress.xml — square widget with ring + play button + text
// ---------------------------------------------------------------------------
const WIDGET_LAYOUT_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background"
    android:padding="8dp">

    <RelativeLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_centerInParent="true">

        <!-- Progress ring -->
        <ImageView
            android:id="@+id/widget_progress_ring"
            android:layout_width="140dp"
            android:layout_height="140dp"
            android:src="@drawable/widget_ring_low"
            android:contentDescription="Progress ring" />

        <!-- Center play/stop button -->
        <FrameLayout
            android:id="@+id/widget_start_button"
            android:layout_width="64dp"
            android:layout_height="64dp"
            android:layout_centerInParent="true"
            android:background="@drawable/widget_button_background"
            android:clickable="true"
            android:focusable="true">

            <ImageView
                android:id="@+id/widget_button_icon"
                android:layout_width="32dp"
                android:layout_height="32dp"
                android:layout_gravity="center"
                android:src="@drawable/widget_play_icon"
                android:contentDescription="Start timer" />
        </FrameLayout>

        <!-- Progress text below ring -->
        <TextView
            android:id="@+id/widget_progress_text"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_below="@id/widget_progress_ring"
            android:layout_centerHorizontal="true"
            android:layout_marginTop="4dp"
            android:text="0 / 30 min"
            android:textSize="12sp"
            android:textStyle="bold"
            android:textColor="#4A7C59" />
    </RelativeLayout>
</RelativeLayout>
`;

// ---------------------------------------------------------------------------
// Widget info
// ---------------------------------------------------------------------------
const WIDGET_INFO_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/widget_description"
    android:initialKeyguardLayout="@layout/widget_progress"
    android:initialLayout="@layout/widget_progress"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:previewImage="@drawable/widget_preview"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="3"
    android:targetCellHeight="3"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen" />
`;

// ---------------------------------------------------------------------------
// Drawable resources
// ---------------------------------------------------------------------------
const WIDGET_BACKGROUND_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#F8F9F7" />
    <corners android:radius="16dp" />
    <stroke
        android:width="1dp"
        android:color="#E8E9E7" />
</shape>
`;

const WIDGET_BUTTON_BG_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="#4A7C59" />
</shape>
`;

const WIDGET_PLAY_ICON_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M8,5v14l11,-7z" />
</vector>
`;

const WIDGET_STOP_ICON_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M6,6h12v12H6z" />
</vector>
`;

const WIDGET_PREVIEW_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#F8F9F7" />
            <corners android:radius="16dp" />
        </shape>
    </item>
    <item
        android:width="80dp"
        android:height="80dp"
        android:gravity="center">
        <shape android:shape="ring"
            android:innerRadius="30dp"
            android:thickness="6dp"
            android:useLevel="false">
            <solid android:color="#4A7C59" />
        </shape>
    </item>
</layer-list>
`;

function ringXml(type, color) {
  return `\
<?xml version="1.0" encoding="utf-8"?>
<!-- Progress ring: ${type} (${color}) -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="ring"
            android:innerRadius="45dp"
            android:thickness="8dp"
            android:useLevel="false">
            <solid android:color="#E8E9E7" />
        </shape>
    </item>
    <item>
        <rotate
            android:fromDegrees="270"
            android:toDegrees="270">
            <shape android:shape="ring"
                android:innerRadius="45dp"
                android:thickness="8dp"
                android:useLevel="false">
                <solid android:color="${color}" />
            </shape>
        </rotate>
    </item>
</layer-list>
`;
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------
module.exports = function withWidget(config) {
  config = withWidgetReceiver(config);
  config = withWidgetStrings(config);
  config = withWidgetSourceFiles(config);
  return config;
};
