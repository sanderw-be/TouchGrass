import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync, initDatabaseAsync, db } from '../storage';
import { fetchWeatherForecast } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { createContainer } from '../core/container';
import { getSmartReminderScheduler } from '../notifications/notificationManager';

interface HeadlessData {
  type: string;
  contributors?: string;
}

export const handleSmartReminder = async (data: HeadlessData) => {
  console.log('[SR_HEADLESS] Task started', data);

  try {
    // 0. Initialize Infrastructure (Database + DI Container)
    await initDatabaseAsync();
    createContainer(db, () => {}); // No-op for feedback in headless mode

    const storageService = new StorageService(db);
    const todayMinutes = await getTodayMinutesAsync();
    const dailyGoal = await getCurrentDailyGoalAsync();
    const targetMinutes = dailyGoal?.targetMinutes ?? 30;

    // 1. Logic Guards
    const todayDateStr = new Date().toDateString();
    const lastTrackedDate = await storageService.getSettingAsync('sent_smart_reminders_date', '');
    let sentSmartReminders =
      parseInt(await storageService.getSettingAsync('sent_smart_reminders_count', '0'), 10) || 0;

    if (lastTrackedDate !== todayDateStr) {
      sentSmartReminders = 0;
    }

    const smartRemindersCount =
      parseInt(await storageService.getSettingAsync('smart_reminders_count', '2'), 10) || 2;

    if (data.type === 'boot_replan') {
      console.log('[SR_HEADLESS] Chain broken detected on boot. Replanning.');
      await storageService.insertBackgroundLogAsync(
        'reminder',
        'Chain broken: Triggering full 48h replan'
      );
      // Exit early but the finally block will still run the replan
      return;
    }

    let shouldSend = true;

    if (data.type === 'smart_reminder') {
      if (todayMinutes >= targetMinutes) {
        console.log('[SR_HEADLESS] Goal already met. Skipping smart reminder.');
        shouldSend = false;
      } else {
        // We will send it, so increment the counter
        sentSmartReminders += 1;
        await storageService.setSettingAsync('sent_smart_reminders_date', todayDateStr);
        await storageService.setSettingAsync(
          'sent_smart_reminders_count',
          sentSmartReminders.toString()
        );
      }
    } else if (data.type === 'catchup_reminder') {
      // Catchup reminder logic: skip if ahead of schedule
      const progressRatio = todayMinutes / targetMinutes;
      const expectedRatio = sentSmartReminders / Math.max(1, smartRemindersCount);

      if (progressRatio > expectedRatio || todayMinutes >= targetMinutes) {
        console.log(
          `[SR_HEADLESS] Ahead of schedule (progress: ${progressRatio.toFixed(2)}, expected: ${expectedRatio.toFixed(2)}). Skipping catchup.`
        );
        shouldSend = false;
      }
    }

    if (shouldSend) {
      // 2. Weather Fetch (best effort)
      const weatherTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const weatherFetch = fetchWeatherForecast({ allowPermissionPrompt: false, isHeadless: true });
      await Promise.race([weatherFetch, weatherTimeout]);

      // 3. Build & Fire Notification
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
        targetMinutes,
        new Date().getHours(),
        contributors
      );

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
    }
  } catch (error) {
    console.error('[SR_HEADLESS] Error in headless task:', error);
  } finally {
    // 4. Proactive Re-plan (Keeping the Chain Going)
    try {
      console.log('[SR_HEADLESS] Triggering proactive re-plan...');
      const scheduler = getSmartReminderScheduler();
      if (scheduler) {
        await scheduler.scheduleUpcomingReminders();
        console.log('[SR_HEADLESS] Re-plan complete.');
      } else {
        console.warn('[SR_HEADLESS] getSmartReminderScheduler returned null or undefined');
      }
    } catch (replanError) {
      console.error('[SR_HEADLESS] Failed to execute proactive re-plan:', replanError);
    }
  }
};
