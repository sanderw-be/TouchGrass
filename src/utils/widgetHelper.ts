/**
 * Widget Helper Module
 *
 * Provides utilities for interacting with the Android home screen widget.
 *
 * Timer integration: The widget writes a `widget_timer_start` key into the
 * app_settings table when the user taps the play button on the widget.  The
 * app reads this on focus to show the running timer in-app.  When the user
 * stops the timer (either from the widget or from the app) the marker is
 * cleared and a session is written.
 */

import { Platform, Linking } from 'react-native';

const WIDGET_TIMER_PARAM = 'startTimer=true';
export const WIDGET_TIMER_KEY = 'widget_timer_start';

/**
 * Check if the app was opened from the widget's "Start Timer" button.
 * The widget sends a deep link: touchgrass://widget?startTimer=true
 */
export async function wasOpenedFromWidgetTimer(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const initialURL = await Linking.getInitialURL();
    return initialURL?.includes(WIDGET_TIMER_PARAM) ?? false;
  } catch (error) {
    console.warn('Error checking widget intent:', error);
    return false;
  }
}

/**
 * Listen for widget deep link events while the app is running.
 * The widget sends: touchgrass://widget?startTimer=true
 */
export function addWidgetTimerListener(callback: () => void): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  const handleURL = (event: { url: string }) => {
    if (event.url.includes(WIDGET_TIMER_PARAM)) {
      callback();
    }
  };

  const subscription = Linking.addEventListener('url', handleURL);

  return () => {
    subscription.remove();
  };
}

/**
 * Widget update manager — placeholder for future native module.
 *
 * Currently widgets auto-update every 30 minutes. A future native
 * module could broadcast APPWIDGET_UPDATE intents for immediate refresh.
 */
export const WidgetUpdateManager = {
  requestUpdate: async (): Promise<void> => {
    if (Platform.OS !== 'android') {
      return;
    }
    console.log('Widget update requested — currently widgets auto-update every 30 minutes');
  },
};

/**
 * Type for widget data displayed by ProgressWidgetProvider.kt.
 */
export interface WidgetData {
  current: number;
  target: number;
}
