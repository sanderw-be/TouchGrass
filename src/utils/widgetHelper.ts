/**
 * Widget Helper Module
 *
 * Provides utilities for interacting with the Android home screen widget.
 * The widget communicates with the app via deep links (touchgrass://widget?startTimer=true).
 */

import { Platform, Linking } from 'react-native';

const WIDGET_TIMER_PARAM = 'startTimer=true';

/**
 * Check if the app was opened from the widget's "Start Timer" button.
 * The widget sends a deep link: touchgrass://widget?startTimer=true
 *
 * @returns Promise<boolean> True if opened from widget timer button
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
 *
 * @param callback Function to call when widget timer button is tapped
 * @returns Cleanup function to remove the listener
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
