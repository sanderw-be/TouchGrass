import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync, initDatabaseAsync, db } from '../storage';
import { fetchWeatherForecast } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { createContainer } from '../core/container';
import { getSmartReminderScheduler, CHANNEL_ID } from '../notifications/notificationManager';
import { colors } from '../utils/theme';

interface HeadlessData {
  type: string;
  contributors?: string;
  title?: string;
  body?: string;
  activityType?: string;
  transitionType?: string;
}

export const handleSmartReminder = async (data: HeadlessData) => {
  console.log('[SR_HEADLESS] Task started', data);

  try {
    // 0. Initialize Infrastructure (Database + DI Container)
    try {
      await initDatabaseAsync();
      createContainer(db);
    } catch (dbError: unknown) {
      const error = dbError as Error;
      console.error('[SR_HEADLESS] Critical database initialization error:', error);
      // We'll log to console but can't log to DB if init failed
    }

    const storageService = new StorageService(db);

    let todayMinutes = 0;
    let targetMinutes = 30;

    try {
      todayMinutes = await getTodayMinutesAsync();
      const dailyGoal = await getCurrentDailyGoalAsync();
      targetMinutes = dailyGoal?.targetMinutes ?? 30;
    } catch (queryError: unknown) {
      console.error('[SR_HEADLESS] Error fetching initial goal/minutes:', queryError);

      // Fallback to safe defaults if DB fails
      todayMinutes = 0;
      targetMinutes = 30;
    }

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

    if (data.type === 'activity_transition') {
      const activity = data.activityType || 'UNKNOWN';
      const transition = data.transitionType || 'UNKNOWN';
      console.log(`[SR_HEADLESS] Activity Transition: ${activity} (${transition})`);

      await storageService.insertBackgroundLogAsync(
        'activity_recognition',
        `Motion: ${activity} | State: ${transition}`
      );

      // --- DWELL TIME LOGIC ---
      // We only care about ENTER transitions (becoming STILL, becoming WALKING, etc.)
      if (transition === 'ENTER') {
        if (activity === 'STILL') {
          console.log('[SR_HEADLESS] User is STILL. Scheduling dwell-time prompt for 2 hours.');
          await Notifications.scheduleNotificationAsync({
            identifier: 'dwell-time-reminder',
            content: {
              title: "You've been here a while",
              body: 'Want to save this location?',
              data: { type: 'dwell_prompt' },
              color: colors.grass,
            },
            trigger: {
              seconds: 2 * 60 * 60, // 2 hours
              channelId: CHANNEL_ID,
            } as Notifications.NotificationTriggerInput,
          });
        } else if (
          activity === 'WALKING' ||
          activity === 'RUNNING' ||
          activity === 'ON_BICYCLE' ||
          activity === 'IN_VEHICLE'
        ) {
          console.log(`[SR_HEADLESS] User is moving (${activity}). Canceling dwell-time prompt.`);
          await Notifications.cancelScheduledNotificationAsync('dwell-time-reminder');
        }
      } else if (transition === 'EXIT' && activity === 'STILL') {
        // If they stop being STILL, cancel the timer
        await Notifications.cancelScheduledNotificationAsync('dwell-time-reminder');
      }

      return;
    }

    let shouldSend = true;

    // 1. Logic Guards
    if (data.type === 'test_reminder') {
      console.log('[SR_HEADLESS] Test reminder detected. Bypassing guards.');
      shouldSend = true;
    } else if (data.type === 'smart_reminder') {
      if (todayMinutes >= targetMinutes) {
        console.log(
          `[SR_HEADLESS] Goal already met (${todayMinutes}/${targetMinutes}). Skipping smart reminder.`
        );
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
      // Catchup reminder logic: send only if activity progress is behind or equal to notification progress
      // Formula: [outside time today] / [daily goal] <= [smart notifications sent] / [total smart reminders]
      const progressRatio = todayMinutes / Math.max(1, targetMinutes);
      const expectedRatio = sentSmartReminders / Math.max(1, smartRemindersCount);

      if (progressRatio <= expectedRatio && todayMinutes < targetMinutes) {
        console.log(
          `[SR_HEADLESS] Catchup triggered: activity progress (${progressRatio.toFixed(2)}) <= notification progress (${expectedRatio.toFixed(2)})`
        );
        shouldSend = true;
      } else {
        console.log(
          `[SR_HEADLESS] Catchup skipped: activity progress (${progressRatio.toFixed(2)}) > notification progress (${expectedRatio.toFixed(2)}) or goal met.`
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
      let finalTitle = data.title;
      let finalBody = data.body;

      // FOR PRODUCTION TYPES: Always rebuild for freshness
      // FOR TEST TYPE: Use provided title/body if available
      const isTest = data.type === 'test_reminder';
      const needsRebuild = !isTest || !finalTitle || !finalBody;

      if (needsRebuild) {
        console.log('[SR_HEADLESS] Building fresh message...');
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
        finalTitle = title;
        finalBody = body;
      } else {
        console.log('[SR_HEADLESS] Using provided test message.');
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: finalTitle,
          body: finalBody,
          data: { type: data.type },
          categoryIdentifier: 'reminder',
          color: colors.grass,
        },
        trigger: { channelId: CHANNEL_ID } as Notifications.NotificationTriggerInput, // Immediate with channel
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
        await scheduler.scheduleUpcomingReminders({ isHeadlessReplan: true });
        console.log('[SR_HEADLESS] Re-plan complete.');
      } else {
        console.warn('[SR_HEADLESS] getSmartReminderScheduler returned null or undefined');
      }
    } catch (replanError) {
      console.error('[SR_HEADLESS] Failed to execute proactive re-plan:', replanError);
    }
  }
};
