import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getTodayMinutes, getCurrentDailyGoal,
  getSetting, setSetting, insertReminderFeedback,
} from '../storage/database';
import { shouldRemindNow, scoreReminderHours } from './reminderAlgorithm';
import { getWeatherForHour, isWeatherDataAvailable } from '../weather/weatherService';
import { getWeatherDescription, getWeatherEmoji, getWeatherPreferences } from '../weather/weatherAlgorithm';
import { hasScheduledNotificationNearby } from './scheduledNotifications';
import { hasUpcomingEvent, maybeAddOutdoorTimeToCalendar } from '../calendar/calendarService';
import { t } from '../i18n';

const NOTIF_TITLES = [
  'notif_title_1',
  'notif_title_2',
  'notif_title_3',
  'notif_title_4',
  'notif_title_5',
];

// Notification action IDs
export const ACTION_WENT_OUTSIDE = 'went_outside';
export const ACTION_SNOOZE = 'snoozed';
export const ACTION_LESS_OFTEN = 'less_often';

const CHANNEL_ID = 'touchgrass_reminders';

/**
 * Set up notification infrastructure without requesting permissions.
 * Call once on app start.
 */
export async function setupNotificationInfrastructure(): Promise<void> {
  // Android notification channels
  if (Platform.OS === 'android') {
    // Always create the background tracking channel, even without notification permissions
    // This is needed for the GPS foreground service notification
    try {
      await Notifications.setNotificationChannelAsync('touchgrass_background', {
        name: t('notif_channel_background_name'),
        description: t('notif_channel_background_desc'),
        importance: Notifications.AndroidImportance.MIN, // no sound, no peek, no badge
        showBadge: false,
        enableVibrate: false,
      });
      console.log('TouchGrass: Background notification channel created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create background channel:', e);
    }

    // Create channel for scheduled notifications
    try {
      await Notifications.setNotificationChannelAsync('touchgrass_scheduled', {
        name: t('notif_channel_scheduled_name'),
        description: t('notif_channel_scheduled_desc'),
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A7C59',
      });
      console.log('TouchGrass: Scheduled notification channel created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create scheduled channel:', e);
    }
  }

  // Set handler for foreground notifications
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Handle notification responses (button taps)
  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
}

/**
 * Request notification permissions and complete setup.
 * Returns true if permissions were granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('TouchGrass: Notification permissions not granted');
    return false;
  }

  // Android notification channel for reminders
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('notif_channel_name'),
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A7C59',
    });
  }

  // Register action categories (the quick-reply buttons)
  await Notifications.setNotificationCategoryAsync('reminder', [
    {
      identifier: ACTION_WENT_OUTSIDE,
      buttonTitle: t('notif_action_went_outside'),
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t('notif_action_snooze'),
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_LESS_OFTEN,
      buttonTitle: t('notif_action_less_often'),
      options: { opensAppToForeground: false },
    },
  ]);

  return true;
}

/**
 * Set up notification channel and action buttons.
 * Call once on app start.
 * @deprecated Use setupNotificationInfrastructure() and requestNotificationPermissions() separately
 */
export async function setupNotifications(): Promise<void> {
  await setupNotificationInfrastructure();
  await requestNotificationPermissions();
}

/**
 * Schedule the next reminder based on the algorithm.
 * Cancels any existing scheduled reminders first.
 */
export async function scheduleNextReminder(): Promise<void> {
  const todayMinutes = getTodayMinutes();
  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;
  const lastReminderMs = parseInt(getSetting('last_reminder_ms', '0'), 10);
  const isCurrentlyOutside = getSetting('currently_outside', '0') === '1';
  const remindersEnabled = getSetting('reminders_enabled', '1') === '1';

  if (!remindersEnabled) return;

  // Skip if there's a scheduled notification nearby
  if (hasScheduledNotificationNearby(60)) {
    console.log('TouchGrass: Skipping automatic reminder - scheduled notification nearby');
    return;
  }

  // Skip if there is an imminent calendar event (smart reminders only)
  const calendarBuffer = parseInt(getSetting('calendar_buffer_minutes', '30'), 10);
  if (await hasUpcomingEvent(calendarBuffer)) {
    console.log('TouchGrass: Skipping smart reminder - upcoming calendar event');
    return;
  }

  const { should, reason } = shouldRemindNow(
    todayMinutes,
    dailyTarget,
    lastReminderMs,
    isCurrentlyOutside,
  );

  if (!should) {
    console.log('TouchGrass: no reminder needed:', reason);
    if (reason === 'daily goal reached') {
      await cancelAutomaticReminders();
    }
    return;
  }

  // Cancel existing automatic reminders (but preserve scheduled ones)
  await cancelAutomaticReminders();

  // Build message based on progress
  const { title, body } = buildReminderMessage(todayMinutes, dailyTarget);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: 'reminder',
      color: '#4A7C59',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });

  // Add a future outdoor time slot to the calendar alongside the reminder
  maybeAddOutdoorTimeToCalendar(new Date()).catch((e) =>
    console.warn('TouchGrass: Failed to add reminder time to calendar:', e),
  );

  setSetting('last_reminder_ms', String(Date.now()));
  console.log('TouchGrass: reminder sent, reason:', reason);
}

/**
 * Schedule reminders for optimal times throughout the day.
 * Call this once in the morning to plan the day's reminders.
 */
export async function scheduleDayReminders(): Promise<void> {
  const todayMinutes = getTodayMinutes();
  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;
  const remindersEnabled = getSetting('reminders_enabled', '1') === '1';

  if (!remindersEnabled) return;

  await cancelAutomaticReminders();

  // Don't schedule reminders if daily goal is already reached
  if (todayMinutes >= dailyTarget) {
    return;
  }

  const currentHour = new Date().getHours();
  const scores = scoreReminderHours(todayMinutes, dailyTarget, currentHour);

  // Pick the top 2 scoring hours for the day
  const topHours = scores
    .filter((s) => s.score >= 0.4 && s.hour > currentHour)
    .slice(0, 2);

  for (const slot of topHours) {
    // Skip this hour if there's a scheduled notification nearby
    const testDate = new Date();
    testDate.setHours(slot.hour, 0, 0, 0);
    const slotMinutes = slot.hour * 60;
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    
    // Simple check: if the slot is within 60 minutes of any scheduled notification
    // We'll do a more precise check in hasScheduledNotificationNearby
    if (hasScheduledNotificationNearby(60)) {
      console.log(`Skipping reminder at ${slot.hour}:00 - scheduled notification nearby`);
      continue;
    }

    const triggerDate = new Date();
    triggerDate.setHours(slot.hour, 0, 0, 0);

    const { title, body } = buildReminderMessage(todayMinutes, dailyTarget, slot.hour);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: 'reminder',
        color: '#4A7C59',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });

    // Add a future outdoor time slot to the calendar for this reminder time
    maybeAddOutdoorTimeToCalendar(triggerDate).catch((e) =>
      console.warn('TouchGrass: Failed to add reminder slot to calendar:', e),
    );
  }
}

/**
 * Cancel only automatic/smart reminders, preserving scheduled notifications.
 */
async function cancelAutomaticReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notif of all) {
    // Only cancel if it's NOT a scheduled notification (those have 'scheduled_' prefix)
    if (!notif.identifier.startsWith('scheduled_')) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Handle user tapping a notification action button.
 */
async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
  const notificationId = response.notification.request.identifier;
  const actionId = response.actionIdentifier;
  const now = Date.now();
  const d = new Date(now);

  const action = actionId === ACTION_WENT_OUTSIDE ? 'went_outside'
    : actionId === ACTION_SNOOZE ? 'snoozed'
    : actionId === ACTION_LESS_OFTEN ? 'less_often'
    : 'dismissed';

  insertReminderFeedback({
    timestamp: now,
    action,
    scheduledHour: d.getHours(),
    dayOfWeek: d.getDay(),
  });

  // Update the notification in-place: re-post with the same identifier using a
  // confirmation message and no categoryIdentifier (which removes the action buttons).
  // On Android, re-posting with the same tag/ID causes NotificationManagerCompat to
  // replace the existing notification entirely — no native reflection needed.
  // The user can swipe to dismiss when ready.
  if (action !== 'dismissed') {
    const confirmBodyKey = action === 'went_outside' ? 'notif_confirm_went_outside'
      : action === 'snoozed' ? 'notif_confirm_snoozed'
      : 'notif_confirm_less_often';

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: t('notif_confirm_title'),
        body: t(confirmBodyKey),
        // No categoryIdentifier: the rebuilt notification has no action buttons
      },
      trigger: null,
    });
  }

  if (action === 'snoozed') {
    // Reschedule for 45 minutes later
    const snoozeDate = new Date(now + 45 * 60 * 1000);
    const snoozeHour = snoozeDate.getHours();
    const { title, body } = buildReminderMessage(
      getTodayMinutes(),
      getCurrentDailyGoal()?.targetMinutes ?? 30,
      snoozeHour,
    );
    await Notifications.scheduleNotificationAsync({
      content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 45 * 60,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/**
 * Build a friendly reminder message based on current progress.
 * Optionally includes weather context if available.
 */
function buildReminderMessage(
  todayMinutes: number,
  dailyTarget: number,
  hour?: number,
): { title: string; body: string } {
  const remaining = Math.max(0, Math.round(dailyTarget - todayMinutes));
  const percent = todayMinutes / dailyTarget;

  const titleKey = NOTIF_TITLES[Math.floor(Math.random() * NOTIF_TITLES.length)];
  const title = t(titleKey);

  let body: string;
  if (todayMinutes === 0) {
    body = t('notif_body_none');
  } else if (percent < 0.5) {
    body = t('notif_body_halfway', { remaining });
  } else if (percent < 1) {
    body = t('notif_body_almost', { remaining });
  } else {
    body = t('notif_body_done');
  }

  // Add weather context if available and enabled
  if (isWeatherDataAvailable()) {
    const weatherPrefs = getWeatherPreferences();
    if (weatherPrefs.enabled) {
      const currentHour = hour ?? new Date().getHours();
      const weather = getWeatherForHour(currentHour);
      
      if (weather) {
        const emoji = getWeatherEmoji(weather);
        const temp = Math.round(weather.temperature);
        
        // Add weather hint to body
        body += ` ${emoji} ${temp}°C outside.`;
      }
    }
  }

  return { title, body };
}
