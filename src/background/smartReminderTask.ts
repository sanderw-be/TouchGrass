import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { fetchWeatherForecast, isWeatherDataAvailable } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { db } from '../storage/db';
import * as weatherAlgorithm from '../weather/weatherAlgorithm';
import { WeatherCondition } from '../weather/types';

interface HeadlessData {
  type: string;
  contributors?: string;
}

export const handleSmartReminder = async (data: HeadlessData) => {
  console.log('[SR_HEADLESS] Task started', data);

  try {
    // 1. Check goal status
    const todayMinutes = await getTodayMinutesAsync();
    const dailyGoal = await getCurrentDailyGoalAsync();

    if (dailyGoal && todayMinutes >= dailyGoal.targetMinutes) {
      console.log('[SR_HEADLESS] Goal already met. Skipping notification.');
      return;
    }

    // 2. Weather Fetch with 1s timeout
    const weatherTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
    const weatherFetch = fetchWeatherForecast({ allowPermissionPrompt: false });

    await Promise.race([weatherFetch, weatherTimeout]);
    const weatherAvailable = await isWeatherDataAvailable();

    // 3. Build Message
    const storageService = new StorageService(db);
    const weatherServiceWrapper = {
      isWeatherDataAvailable: () => isWeatherDataAvailable(),
    };

    const messageBuilder = new ReminderMessageBuilder(storageService, weatherServiceWrapper, {
      getWeatherEmoji: (code: number | null) =>
        weatherAlgorithm.getWeatherEmoji(
          code === null ? null : ({ weatherCode: code, isDay: true } as unknown as WeatherCondition)
        ),
      getWeatherDescription: (code: number | null) =>
        weatherAlgorithm.getWeatherDescription(
          code === null ? null : ({ weatherCode: code } as unknown as WeatherCondition)
        ),
    });

    let contributors: string[] = [];
    if (data.contributors) {
      try {
        contributors = JSON.parse(data.contributors);
      } catch (e) {
        console.warn('[SR_HEADLESS] Failed to parse contributors:', e);
      }
    }

    const { title, body } = await messageBuilder.buildReminderMessage(
      todayMinutes,
      dailyGoal?.targetMinutes ?? 30,
      new Date().getHours(),
      contributors,
      weatherAvailable
    );

    // 4. Schedule Notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: data.type },
        categoryIdentifier: 'reminder',
        color: '#4A7C59',
      },
      trigger: null, // immediate
    });

    console.log('[SR_HEADLESS] Notification triggered successfully');
  } catch (error) {
    console.error('[SR_HEADLESS] Error in headless task:', error);
  }
};
