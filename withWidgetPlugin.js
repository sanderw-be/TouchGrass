/**
 * Expo config plugin to add Android home screen widget support.
 * This plugin injects the widget provider, layout, and drawable resources
 * into the native Android project during prebuild.
 */

const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Add widget provider to AndroidManifest.xml
 */
function withWidgetReceiver(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application?.[0];

    if (!application) {
      throw new Error('AndroidManifest.xml is missing application element');
    }

    // Add widget receiver
    if (!application.receiver) {
      application.receiver = [];
    }

    // Check if widget receiver already exists
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
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
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

/**
 * Add widget description string
 */
function withWidgetStrings(config) {
  return withStringsXml(config, async (config) => {
    const strings = config.modResults;

    // Add widget description if not exists
    const widgetDescExists = strings.resources.string?.some(
      (str) => str.$.name === 'widget_description'
    );

    if (!widgetDescExists) {
      if (!strings.resources.string) {
        strings.resources.string = [];
      }
      strings.resources.string.push({
        $: { name: 'widget_description' },
        _: 'Shows your daily outdoor progress and lets you start a timer',
      });
    }

    return config;
  });
}

/**
 * Create widget source files in android directory
 */
function withWidgetSourceFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidDir = path.join(projectRoot, 'android');

      // Ensure android directory exists (it will during prebuild)
      if (fs.existsSync(androidDir)) {
        const packagePath = path.join(androidDir, 'app/src/main/java/com/jollyheron/touchgrass');
        const resPath = path.join(androidDir, 'app/src/main/res');

        // Create ProgressWidgetProvider.kt
        const widgetProviderPath = path.join(packagePath, 'ProgressWidgetProvider.kt');
        if (!fs.existsSync(widgetProviderPath)) {
          fs.mkdirSync(packagePath, { recursive: true });
          fs.writeFileSync(widgetProviderPath, getWidgetProviderKotlin());
        }

        // Create widget layout XML
        const layoutDir = path.join(resPath, 'layout');
        const widgetLayoutPath = path.join(layoutDir, 'widget_progress.xml');
        if (!fs.existsSync(widgetLayoutPath)) {
          fs.mkdirSync(layoutDir, { recursive: true });
          fs.writeFileSync(widgetLayoutPath, getWidgetLayoutXml());
        }

        // Create widget info XML
        const xmlDir = path.join(resPath, 'xml');
        const widgetInfoPath = path.join(xmlDir, 'widget_info.xml');
        if (!fs.existsSync(widgetInfoPath)) {
          fs.mkdirSync(xmlDir, { recursive: true });
          fs.writeFileSync(widgetInfoPath, getWidgetInfoXml());
        }

        // Create drawable resources
        const drawableDir = path.join(resPath, 'drawable');
        fs.mkdirSync(drawableDir, { recursive: true });

        const drawables = {
          widget_background: getWidgetBackgroundXml(),
          widget_button_background: getWidgetButtonBackgroundXml(),
          widget_play_icon: getWidgetPlayIconXml(),
          widget_preview: getWidgetPreviewXml(),
          widget_ring_low: getWidgetRingXml('low', '#7EB8D4'),
          widget_ring_medium: getWidgetRingXml('medium', '#F5C842'),
          widget_ring_good: getWidgetRingXml('good', '#4A7C59'),
          widget_ring_complete: getWidgetRingXml('complete', '#6BAF7A'),
        };

        for (const [name, content] of Object.entries(drawables)) {
          const drawablePath = path.join(drawableDir, `${name}.xml`);
          if (!fs.existsSync(drawablePath)) {
            fs.writeFileSync(drawablePath, content);
          }
        }
      }

      return config;
    },
  ]);
}

// Kotlin source for ProgressWidgetProvider
function getWidgetProviderKotlin() {
  return `package com.jollyheron.touchgrass

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.widget.RemoteViews
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Home screen widget that displays daily progress ring and a "Start Timer" button.
 * Shows current outdoor minutes vs. daily goal with color-coded progress.
 */
class ProgressWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update each widget instance
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // First widget added - perform any initial setup if needed
    }

    override fun onDisabled(context: Context) {
        // Last widget removed - cleanup if needed
    }

    companion object {
        private const val ACTION_START_TIMER = "com.jollyheron.touchgrass.START_TIMER"

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_progress)

            // Fetch data from SQLite database
            val widgetData = getWidgetData(context)

            // Calculate progress percentage
            val progress = if (widgetData.target > 0) {
                ((widgetData.current.toFloat() / widgetData.target.toFloat()) * 100).toInt()
            } else {
                0
            }

            // Set progress text
            views.setTextViewText(R.id.widget_current_minutes, "\${widgetData.current}m")
            views.setTextViewText(
                R.id.widget_target_minutes,
                "of \${widgetData.target}m"
            )

            // Update progress ring color based on percentage
            val ringDrawable = when {
                progress >= 100 -> R.drawable.widget_ring_complete
                progress >= 60 -> R.drawable.widget_ring_good
                progress >= 30 -> R.drawable.widget_ring_medium
                else -> R.drawable.widget_ring_low
            }
            views.setImageViewResource(R.id.widget_progress_ring, ringDrawable)

            // Set progress percentage text
            views.setTextViewText(R.id.widget_progress_percent, "$progress%")

            // Setup Start Timer button click
            val startTimerIntent = Intent(context, MainActivity::class.java).apply {
                action = ACTION_START_TIMER
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("startTimer", true)
            }
            val startTimerPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                startTimerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_start_button, startTimerPendingIntent)

            // Setup widget click to open app
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openAppPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId + 1000,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, openAppPendingIntent)

            // Update the widget
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun getWidgetData(context: Context): WidgetData {
            try {
                // Path to expo-sqlite database
                val dbPath = File(context.getDatabasePath("touchgrass.db").absolutePath)

                if (!dbPath.exists()) {
                    return WidgetData(0, 30) // Default: 0 minutes of 30 minute goal
                }

                val db = SQLiteDatabase.openDatabase(
                    dbPath.absolutePath,
                    null,
                    SQLiteDatabase.OPEN_READONLY
                )

                try {
                    // Get today's date in YYYY-MM-DD format
                    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

                    // Get today's total minutes
                    val currentMinutes = getTodayMinutes(db, today)

                    // Get daily goal from settings
                    val targetMinutes = getDailyGoal(db)

                    return WidgetData(currentMinutes, targetMinutes)
                } finally {
                    db.close()
                }
            } catch (e: Exception) {
                // Log error but return default values to prevent widget crashes
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
                if (cursor.moveToFirst()) {
                    return cursor.getInt(0)
                }
            }
            return 0
        }

        private fun getDailyGoal(db: SQLiteDatabase): Int {
            val query = "SELECT value FROM settings WHERE key = 'daily_goal'"

            db.rawQuery(query, null).use { cursor ->
                if (cursor.moveToFirst()) {
                    return cursor.getString(0).toIntOrNull() ?: 30
                }
            }
            return 30 // Default goal
        }
    }
}

data class WidgetData(
    val current: Int,  // Current minutes today
    val target: Int    // Daily goal in minutes
)
`;
}

// Widget layout XML
function getWidgetLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background"
    android:padding="16dp">

    <!-- Progress Ring Container -->
    <RelativeLayout
        android:id="@+id/progress_ring_container"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_centerInParent="true">

        <!-- Progress Ring Background -->
        <ImageView
            android:id="@+id/widget_progress_ring"
            android:layout_width="120dp"
            android:layout_height="120dp"
            android:src="@drawable/widget_ring_low"
            android:contentDescription="Progress ring" />

        <!-- Center Content -->
        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_centerInParent="true"
            android:orientation="vertical"
            android:gravity="center">

            <TextView
                android:id="@+id/widget_current_minutes"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="0m"
                android:textSize="24sp"
                android:textStyle="bold"
                android:textColor="#2C3E2E" />

            <TextView
                android:id="@+id/widget_target_minutes"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="of 30m"
                android:textSize="11sp"
                android:textColor="#6C7A6D"
                android:layout_marginTop="2dp" />

            <TextView
                android:id="@+id/widget_progress_percent"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="0%"
                android:textSize="10sp"
                android:textColor="#4A7C59"
                android:textStyle="bold"
                android:layout_marginTop="2dp" />
        </LinearLayout>
    </RelativeLayout>

    <!-- Start Timer Button -->
    <LinearLayout
        android:id="@+id/widget_start_button"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_below="@id/progress_ring_container"
        android:layout_marginTop="12dp"
        android:background="@drawable/widget_button_background"
        android:gravity="center"
        android:orientation="horizontal"
        android:padding="12dp"
        android:clickable="true"
        android:focusable="true">

        <ImageView
            android:layout_width="20dp"
            android:layout_height="20dp"
            android:src="@drawable/widget_play_icon"
            android:contentDescription="Play icon"
            android:layout_marginEnd="8dp" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Start Timer"
            android:textSize="14sp"
            android:textStyle="bold"
            android:textColor="#FFFFFF" />
    </LinearLayout>

    <!-- App Name/Label at top -->
    <TextView
        android:id="@+id/widget_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_alignParentTop="true"
        android:layout_centerHorizontal="true"
        android:text="TouchGrass"
        android:textSize="12sp"
        android:textStyle="bold"
        android:textColor="#4A7C59"
        android:letterSpacing="0.05" />

</RelativeLayout>
`;
}

// Widget info XML
function getWidgetInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
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
}

// Drawable XML generators
function getWidgetBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#F8F9F7" />
    <corners android:radius="16dp" />
    <stroke
        android:width="1dp"
        android:color="#E8E9E7" />
</shape>
`;
}

function getWidgetButtonBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#4A7C59" />
    <corners android:radius="8dp" />
</shape>
`;
}

function getWidgetPlayIconXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
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
}

function getWidgetPreviewXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Widget preview placeholder - uses simple shapes -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Background -->
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#F8F9F7" />
            <corners android:radius="16dp" />
        </shape>
    </item>
    <!-- Ring placeholder -->
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
}

function getWidgetRingXml(type, color) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Progress ring: ${type} (${color}) -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Background ring -->
    <item>
        <shape android:shape="ring"
            android:innerRadius="45dp"
            android:thickness="8dp"
            android:useLevel="false">
            <solid android:color="#E8E9E7" />
        </shape>
    </item>
    <!-- Progress ring -->
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

/**
 * Main plugin export
 */
module.exports = function withWidget(config) {
  config = withWidgetReceiver(config);
  config = withWidgetStrings(config);
  config = withWidgetSourceFiles(config);
  return config;
};
