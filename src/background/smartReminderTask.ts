import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { fetchWeatherForecast } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { db } from '../storage/db';

interface HeadlessData {
  type: string;
  contributors?: string;
}

export const handleSmartReminder = async (data: HeadlessData) => {
  console.log('[SR_HEADLESS] Task started', data);
  const storageService = new StorageService(db);

  try {
    const todayMinutes = await getTodayMinutesAsync();
    const dailyGoal = await getCurrentDailyGoalAsync();
    const targetMinutes = dailyGoal?.targetMinutes ?? 30;

    // Load state
    const todayDateStr = new Date().toDateString();
    const lastTrackedDate = await storageService.getSettingAsync('sent_smart_reminders_date', '');
    let sentSmartReminders =
      parseInt(await storageService.getSettingAsync('sent_smart_reminders_count', '0'), 10) || 0;

    if (lastTrackedDate !== todayDateStr) {
      sentSmartReminders = 0;
    }

    const smartRemindersCount =
      parseInt(await storageService.getSettingAsync('smart_reminders_count', '2'), 10) || 2;

    if (data.type === 'smart_reminder') {
      if (todayMinutes >= targetMinutes) {
        console.log('[SR_HEADLESS] Goal already met. Skipping smart reminder.');
        return;
      }

      // We will send it, so increment the counter
      sentSmartReminders += 1;
      await storageService.setSettingAsync('sent_smart_reminders_date', todayDateStr);
      await storageService.setSettingAsync(
        'sent_smart_reminders_count',
        sentSmartReminders.toString()
      );
    } else if (data.type === 'catchup_reminder') {
      // Catchup reminder logic: skip if ahead of schedule
      const progressRatio = todayMinutes / targetMinutes;
      const expectedRatio = sentSmartReminders / Math.max(1, smartRemindersCount); // Avoid div by 0

      if (progressRatio > expectedRatio || todayMinutes >= targetMinutes) {
        console.log(
          `[SR_HEADLESS] Ahead of schedule (progress: ${progressRatio.toFixed(2)}, expected: ${expectedRatio.toFixed(2)}). Skipping catchup.`
        );
        return;
      }
    }

    // 2. Weather Fetch with 1s timeout
    const weatherTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
    const weatherFetch = fetchWeatherForecast({ allowPermissionPrompt: false });

    await Promise.race([weatherFetch, weatherTimeout]);

    // 3. Build Message
    const messageBuilder = new ReminderMessageBuilder(storageService);

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
      contributors
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
