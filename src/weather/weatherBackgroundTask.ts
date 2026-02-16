/**
 * Background task for weather data updates
 * Runs approximately every hour to keep weather forecast fresh
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { fetchWeatherForecast } from './weatherService';
import { getSetting } from '../storage/database';

const WEATHER_BACKGROUND_TASK = 'WEATHER_BACKGROUND_FETCH';

/**
 * Define the weather background fetch task
 * This runs periodically (approximately every hour) to update weather data
 */
TaskManager.defineTask(WEATHER_BACKGROUND_TASK, async () => {
  try {
    // Check if weather is enabled
    const weatherEnabled = getSetting('weather_enabled', '1') === '1';
    if (!weatherEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Fetch fresh weather data
    const result = await fetchWeatherForecast();
    
    if (result.success) {
      console.log('Weather background fetch successful');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.warn('Weather background fetch failed:', result.error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  } catch (error) {
    console.error('Weather background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the weather background fetch task
 * Call this during app initialization
 */
export async function registerWeatherBackgroundFetch(): Promise<void> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WEATHER_BACKGROUND_TASK);
    
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(WEATHER_BACKGROUND_TASK, {
        minimumInterval: 60 * 60, // 1 hour in seconds
        stopOnTerminate: false, // Continue after app is terminated
        startOnBoot: true, // Start when device boots
      });
      console.log('Weather background fetch registered');
    }
  } catch (error) {
    console.error('Failed to register weather background fetch:', error);
  }
}

/**
 * Unregister the weather background fetch task
 * Useful for testing or when user disables weather features
 */
export async function unregisterWeatherBackgroundFetch(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WEATHER_BACKGROUND_TASK);
    
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(WEATHER_BACKGROUND_TASK);
      console.log('Weather background fetch unregistered');
    }
  } catch (error) {
    console.error('Failed to unregister weather background fetch:', error);
  }
}
