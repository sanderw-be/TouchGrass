/**
 * Widget Helper Module
 *
 * Provides utilities for interacting with the Android home screen widget.
 * Currently handles widget-related intents passed to the app.
 */

import { Platform, Linking } from 'react-native';

/**
 * Check if the app was opened from the widget's "Start Timer" button.
 * This checks for the deep link intent passed by the widget.
 *
 * @returns Promise<boolean> True if opened from widget timer button
 */
export async function wasOpenedFromWidgetTimer(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const initialURL = await Linking.getInitialURL();
    // Check if URL contains the widget timer intent marker
    return initialURL?.includes('startTimer=true') ?? false;
  } catch (error) {
    console.warn('Error checking widget intent:', error);
    return false;
  }
}

/**
 * Listen for widget deep link events.
 * Call this in your app's initialization to handle widget button taps.
 *
 * @param callback Function to call when widget timer button is tapped
 * @returns Cleanup function to remove the listener
 */
export function addWidgetTimerListener(callback: () => void): () => void {
  if (Platform.OS !== 'android') {
    return () => {}; // No-op cleanup for non-Android
  }

  const handleURL = (event: { url: string }) => {
    if (event.url.includes('startTimer=true')) {
      callback();
    }
  };

  const subscription = Linking.addEventListener('url', handleURL);

  return () => {
    subscription.remove();
  };
}

/**
 * Widget update manager - placeholder for future implementation.
 *
 * Note: Currently, widgets auto-update every 30 minutes. To implement
 * manual updates, we would need to create a native module that can
 * broadcast APPWIDGET_UPDATE intents to the ProgressWidgetProvider.
 *
 * Future enhancement:
 * - Create native module: modules/widget-bridge-native
 * - Expose updateWidgets() method
 * - Call from app when sessions are approved/logged
 */
export const WidgetUpdateManager = {
  /**
   * Request an immediate widget update (not yet implemented).
   * Widgets currently update automatically every 30 minutes.
   */
  requestUpdate: async (): Promise<void> => {
    if (Platform.OS !== 'android') {
      return;
    }

    // TODO: Implement native module to trigger widget updates
    // For now, widgets update on their 30-minute schedule
    console.log('Widget update requested - currently widgets auto-update every 30 minutes');
  },
};

/**
 * Type for widget data that would be displayed.
 * Matches the data structure used by ProgressWidgetProvider.kt
 */
export interface WidgetData {
  current: number; // Current minutes today
  target: number; // Daily goal in minutes
}
