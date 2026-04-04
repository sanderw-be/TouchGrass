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
  getTodayMinutes,
  getCurrentDailyGoal,
  getSetting,
  initDatabase,
} from '../storage/database';

export const WIDGET_TIMER_KEY = 'widget_timer_start';

/**
 * Request an immediate update of all widget instances.
 *
 * On Android this triggers the task handler's WIDGET_UPDATE action via
 * react-native-android-widget.  On other platforms this is a no-op.
 */
export async function requestWidgetRefresh(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    initDatabase();
    const current = getTodayMinutes();
    const target = getCurrentDailyGoal()?.targetMinutes ?? 30;
    const marker = getSetting(WIDGET_TIMER_KEY, '');
    const timerRunning = marker !== '' && !isNaN(parseInt(marker, 10)) && parseInt(marker, 10) > 0;

    await requestWidgetUpdate({
      widgetName: 'Progress',
      renderWidget: () => ProgressWidget({ current, target, timerRunning }),
    });
  } catch (error) {
    console.warn('Widget refresh failed:', error);
  }
}
