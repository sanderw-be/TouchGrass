/**
 * Widget Helper Module
 *
 * Provides utilities for syncing state between the Android home screen
 * widget (built with react-native-android-widget) and the in-app UI.
 *
 * Timer integration: The widget writes a `widget_timer_start` key into the
 * app_settings table when the user taps Start on the widget.  The app reads
 * this on focus to show the running timer in-app.  When the user stops the
 * timer (either from the widget or from the app) the marker is cleared.
 */

import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ProgressWidget } from '../widget/ProgressWidget';
import {
  getTodayMinutesAsync,
  getCurrentDailyGoalAsync,
  getSettingAsync,
  initDatabaseAsync,
} from '../storage';

export const WIDGET_TIMER_KEY = 'widget_timer_start';

/**
 * Parse the widget timer marker and return whether the timer is running.
 * Shared across widgetHelper, widget-task-handler, and HomeScreen.
 */
export function isWidgetTimerRunning(marker: string): boolean {
  if (marker === '') return false;
  const ts = parseInt(marker, 10);
  return !isNaN(ts) && ts > 0;
}

/**
 * Request an immediate update of all widget instances.
 *
 * On Android this triggers the task handler's WIDGET_UPDATE action via
 * react-native-android-widget.  On other platforms this is a no-op.
 */
export async function requestWidgetRefresh(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await initDatabaseAsync();
    const current = await getTodayMinutesAsync();
    const target = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    const marker = await getSettingAsync(WIDGET_TIMER_KEY, '');
    const timerRunning = isWidgetTimerRunning(marker);
    const timerStartMs = timerRunning ? parseInt(marker, 10) : undefined;

    await requestWidgetUpdate({
      widgetName: 'Progress',
      renderWidget: (widgetInfo) =>
        ProgressWidget({
          current,
          target,
          timerRunning,
          timerStartMs,
          widgetWidth: widgetInfo.width,
          widgetHeight: widgetInfo.height,
        }),
    });
  } catch (error) {
    console.warn('Widget refresh failed:', error);
  }
}
