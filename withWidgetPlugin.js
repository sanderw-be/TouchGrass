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
// Reads data from the SQLite database and renders a RemoteViews widget.
// The "Start Timer" button sends a deep link Intent so that React Native's
// Linking API sees it as a URL (touchgrass://widget?startTimer=true).
// ---------------------------------------------------------------------------
const WIDGET_PROVIDER_KT = `\
package com.jollyheron.touchgrass

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.*

/**
 * Home screen widget — shows daily progress ring and a "Start Timer" button.
 */
class ProgressWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_progress)
            val data = getWidgetData(context)

            val progress = if (data.target > 0) {
                ((data.current.toFloat() / data.target.toFloat()) * 100).toInt()
            } else 0

            // Progress text
            views.setTextViewText(
                R.id.widget_progress_text,
                "\${data.current} / \${data.target} min"
            )

            // Ring colour
            val ringDrawable = when {
                progress >= 100 -> R.drawable.widget_ring_complete
                progress >= 60  -> R.drawable.widget_ring_good
                progress >= 30  -> R.drawable.widget_ring_medium
                else            -> R.drawable.widget_ring_low
            }
            views.setImageViewResource(R.id.widget_progress_ring, ringDrawable)

            // --- Start Timer button: deep-link Intent ---
            // Using ACTION_VIEW + data URI so React Native Linking sees the URL.
            val timerIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("touchgrass://widget?startTimer=true")
            ).apply {
                setClassName(context, "com.jollyheron.touchgrass.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val timerPending = PendingIntent.getActivity(
                context,
                appWidgetId,
                timerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_start_button, timerPending)

            // --- Tap anywhere else opens the app normally ---
            val openIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("touchgrass://home")
            ).apply {
                setClassName(context, "com.jollyheron.touchgrass.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPending = PendingIntent.getActivity(
                context,
                appWidgetId + 10000,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, openPending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        // ---- SQLite helpers ------------------------------------------------

        private fun getWidgetData(context: Context): WidgetData {
            try {
                val dbPath = context.getDatabasePath("touchgrass.db")
                if (!dbPath.exists()) return WidgetData(0, 30)

                val db = SQLiteDatabase.openDatabase(
                    dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY
                )
                try {
                    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                    val current = getTodayMinutes(db, today)
                    val target  = getDailyGoal(db)
                    return WidgetData(current, target)
                } finally {
                    db.close()
                }
            } catch (e: Exception) {
                android.util.Log.e("TouchGrassWidget", "Error fetching widget data", e)
                return WidgetData(0, 30)
            }
        }

        private fun getTodayMinutes(db: SQLiteDatabase, today: String): Int {
            val query = """
                SELECT COALESCE(SUM(duration), 0) as total
                FROM sessions
                WHERE date(start_time) = ?
                AND user_confirmed = 1
            """.trimIndent()
            db.rawQuery(query, arrayOf(today)).use { cursor ->
                if (cursor.moveToFirst()) return cursor.getInt(0)
            }
            return 0
        }

        private fun getDailyGoal(db: SQLiteDatabase): Int {
            db.rawQuery(
                "SELECT value FROM settings WHERE key = 'daily_goal'", null
            ).use { cursor ->
                if (cursor.moveToFirst()) return cursor.getString(0).toIntOrNull() ?: 30
            }
            return 30
        }
    }
}

data class WidgetData(val current: Int, val target: Int)
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

        <!-- Center play button -->
        <FrameLayout
            android:id="@+id/widget_start_button"
            android:layout_width="64dp"
            android:layout_height="64dp"
            android:layout_centerInParent="true"
            android:background="@drawable/widget_button_background"
            android:clickable="true"
            android:focusable="true">

            <ImageView
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
