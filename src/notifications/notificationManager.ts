import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import {
  getTodayMinutes, getCurrentDailyGoal,
  getSetting, setSetting, insertReminderFeedback,
} from '../storage/database';
import { shouldRemindNow, scoreReminderHours, ScoreContributor } from './reminderAlgorithm';
import { fetchWeatherForecast, getWeatherForHour, isWeatherDataAvailable } from '../weather/weatherService';
import { getWeatherDescription, getWeatherEmoji, getWeatherPreferences } from '../weather/weatherAlgorithm';
import {
  hasScheduledNotificationNearby, isSlotNearScheduledNotification,
  scheduleAllScheduledNotifications,
} from './scheduledNotifications';
import { hasUpcomingEvent, maybeAddOutdoorTimeToCalendar, deleteFutureTouchGrassEvents } from '../calendar/calendarService';
import { triggerReminderFeedbackModal } from '../context/ReminderFeedbackContext';
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
const DEFAULT_ANDROID_CHANNEL_ID = 'default';
const SNOOZE_DURATION_MINUTES = 30;

const DAILY_PLANNER_CHANNEL_ID = 'touchgrass_daily_planner';
export const DAILY_PLANNER_NOTIF_PREFIX = 'daily_planner_';

// Prefix for "failsafe" reminders — DATE triggers scheduled for the next
// FAILSAFE_DAYS_AHEAD days whenever scheduleDayReminders() runs.
// Because DATE triggers go through AlarmManager, they survive app force-close
// and fire even if JS never runs at 3 AM.
export const FAILSAFE_REMINDER_PREFIX = 'failsafe_reminder_';
const FAILSAFE_DAYS_AHEAD = 3;

// ---------------------------------------------------------------------------
// Stateful reminder queue — persisted in app_settings as 'smart_reminder_queue'
// ---------------------------------------------------------------------------

export type ReminderQueueStatus = 'date_planned' | 'tick_planned';

export interface ReminderQueueEntry {
  id: string;          // unique notification identifier, also used as the Expo notification identifier
  slotMinutes: number; // minutes-of-day for this slot (e.g. 840 = 14:00)
  status: ReminderQueueStatus;
}

/** Read and parse the reminder queue from settings. Returns [] on parse error. */
function getQueue(): ReminderQueueEntry[] {
  try {
    const raw = getSetting('smart_reminder_queue', '[]');
    return JSON.parse(raw) as ReminderQueueEntry[];
  } catch {
    return [];
  }
}

/** Serialize and persist the reminder queue to settings. */
function saveQueue(queue: ReminderQueueEntry[]): void {
  setSetting('smart_reminder_queue', JSON.stringify(queue));
}

// ---------------------------------------------------------------------------
// Background notification task for the 3 AM daily planner wake-up.
// Defined at module scope so expo-task-manager can invoke it in a headless
// JS context (killed app state on Android).
// ---------------------------------------------------------------------------
// NOTE: The daily planner TaskManager and related functions have been removed
// and replaced by the new persistent background service architecture.

async function createReminderChannels(): Promise<void> {
  const reminderChannelConfig = {
    name: t('notif_channel_name'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4A7C59',
    showBadge: true,
  };

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, reminderChannelConfig);
  await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, reminderChannelConfig);
}

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
        showBadge: true,
      });
      console.log('TouchGrass: Scheduled notification channel created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create scheduled channel:', e);
    }

    // Create channels for reminders (default + explicit)
    try {
      await createReminderChannels();
      console.log('TouchGrass: Reminder notification channels created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create reminder channels:', e);
    }

    // Create the silent daily planner channel used for the 3 AM wake-up
    try {
      await Notifications.setNotificationChannelAsync(DAILY_PLANNER_CHANNEL_ID, {
        name: t('notif_channel_daily_planner_name'),
        description: t('notif_channel_daily_planner_desc'),
        importance: Notifications.AndroidImportance.MIN, // no sound, no peek, no badge
        showBadge: false,
        enableVibrate: false,
      });
      console.log('TouchGrass: Daily planner notification channel created');
    } catch (e) {
      console.warn('TouchGrass: Failed to create daily planner channel:', e);
    }
  }

  // Re-register notification action categories on every app start.
  // This must run every startup (not just during onboarding) so that
  // scheduled notifications can resolve the 'reminder' category when
  // they fire — even after the app is killed and restarted.
  try {
    await Notifications.setNotificationCategoryAsync('reminder', [
      {
        identifier: ACTION_WENT_OUTSIDE,
        buttonTitle: t('notif_action_went_outside'),
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: t('notif_action_snooze'),
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_LESS_OFTEN,
        buttonTitle: t('notif_action_less_often'),
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn('TouchGrass: Failed to register notification categories:', e);
  }

  // Set handler for foreground notifications.
  // Suppress display of the daily planner wake-up — it is only a silent
  // background trigger, not something the user should see in the tray.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isDailyPlanner = notification.request.identifier.startsWith(DAILY_PLANNER_NOTIF_PREFIX);
      return {
        shouldShowAlert: !isDailyPlanner,
        shouldPlaySound: !isDailyPlanner,
        shouldSetBadge: false,
        shouldShowBanner: !isDailyPlanner,
        shouldShowList: !isDailyPlanner,
      };
    },
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
    await createReminderChannels();
  }

  // Register action categories (the quick-reply buttons)
  await Notifications.setNotificationCategoryAsync('reminder', [
    {
      identifier: ACTION_WENT_OUTSIDE,
      buttonTitle: t('notif_action_went_outside'),
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t('notif_action_snooze'),
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_LESS_OFTEN,
      buttonTitle: t('notif_action_less_often'),
      options: { opensAppToForeground: true },
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
  const remindersCount = parseInt(getSetting('smart_reminders_count', '2'), 10);

  if (remindersCount === 0) return;

  // Cancel all remaining smart reminders as soon as the daily goal is reached.
  // This check must come before the other early-returns so that a nearby
  // scheduled notification or calendar event cannot prevent the cancellation.
  if (todayMinutes >= dailyTarget) {
    console.log('TouchGrass: daily goal reached — cancelling remaining smart reminders');
    await cancelAutomaticReminders();
    setSetting('reminders_planned_slots', '[]');
    setSetting('catchup_reminder_slot_minutes', '');
    return;
  }

  // When scheduleDayReminders() has already planned today's reminders, let them
  // handle the schedule. scheduleNextReminder() must not cancel or override the
  // planned notifications (it calls cancelAutomaticReminders which would wipe
  // them out).
  const todayStr = new Date().toDateString();
  const lastPlannedDate = getSetting('reminders_last_planned_date', '');
  if (lastPlannedDate === todayStr) {
    return;
  }

  const lastReminderMs = parseInt(getSetting('last_reminder_ms', '0'), 10);
  const isCurrentlyOutside = getSetting('currently_outside', '0') === '1';

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

  const { should, reason, contributors } = shouldRemindNow(
    todayMinutes,
    dailyTarget,
    lastReminderMs,
    isCurrentlyOutside,
  );

  if (!should) {
    console.log('TouchGrass: no reminder needed:', reason);
    return;
  }

  // Cancel existing automatic reminders (but preserve scheduled ones)
  await cancelAutomaticReminders();

  // Build message based on progress
  const { title, body } = buildReminderMessage(todayMinutes, dailyTarget, undefined, contributors);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: 'reminder',
      color: '#4A7C59',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: CHANNEL_ID,
    },
  });

  // Calendar events are only created by scheduleDayReminders() at planned
  // half-hour slots. scheduleNextReminder() is a fallback that fires at
  // arbitrary background-task wake times, so it must not create calendar events.

  setSetting('last_reminder_ms', String(Date.now()));
  console.log('TouchGrass: reminder sent, reason:', reason);
}

/**
 * Process the stateful reminder queue on each background tick or foreground wake.
 *
 * Steps:
 * 1. Goal reached → cancel all queued DATE triggers and clear the queue.
 * 2. Look-ahead: `date_planned` entries firing within the next WINDOW minutes
 *    → cancel their DATE trigger and promote to `tick_planned` so look-back
 *    can fire them via JS.
 * 3. Look-back: `tick_planned` entries whose slot is in the past WINDOW minutes
 *    → fire immediately via TIME_INTERVAL: 1 and remove from queue.
 * 4. Stale cleanup: entries more than WINDOW minutes past → drop silently
 *    (DATE trigger already fired natively via AlarmManager, or was missed).
 */
export async function processReminderQueue(): Promise<void> {
  const remindersCount = parseInt(getSetting('smart_reminders_count', '0'), 10);
  if (remindersCount === 0) return;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const WINDOW = 15; // minutes

  let queue = getQueue();
  if (queue.length === 0) return;

  const todayMinutes = getTodayMinutes();
  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;

  // --- Goal reached: cancel everything ---
  if (todayMinutes >= dailyTarget) {
    console.log('TouchGrass: [Queue] Daily goal reached — cancelling all queued reminders');
    for (const entry of queue) {
      await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
    }
    saveQueue([]);
    setSetting('reminders_planned_slots', '[]');
    setSetting('catchup_reminder_slot_minutes', '');
    return;
  }

  // --- Look-ahead: date_planned entries firing within next WINDOW minutes ---
  // Cancel their DATE trigger; mark tick_planned so look-back fires them via JS
  for (const entry of queue) {
    if (entry.status !== 'date_planned') continue;
    const minutesUntil = entry.slotMinutes - nowMinutes;
    if (minutesUntil >= 0 && minutesUntil <= WINDOW) {
      await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
      entry.status = 'tick_planned';
      console.log(`TouchGrass: [Queue] Look-ahead: promoted ${entry.id} to tick_planned`);
    }
  }

  // --- Look-back: tick_planned entries whose slot is in the past WINDOW minutes ---
  const updatedQueue: ReminderQueueEntry[] = [];
  for (const entry of queue) {
    if (entry.status === 'tick_planned') {
      const minutesSince = nowMinutes - entry.slotMinutes;
      if (minutesSince >= 0 && minutesSince <= WINDOW) {
        // Fire now
        const { title, body } = buildReminderMessage(todayMinutes, dailyTarget, Math.floor(entry.slotMinutes / 60));
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            categoryIdentifier: 'reminder',
            color: '#4A7C59',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            channelId: CHANNEL_ID,
          },
        });
        setSetting('last_reminder_ms', String(Date.now()));
        console.log(`TouchGrass: [Queue] Look-back: fired ${entry.id} via JS`);
        // Do NOT add to updatedQueue — entry is consumed
        continue;
      } else if (minutesSince > WINDOW) {
        // Window passed without JS running — entry is stale, drop it
        console.log(`TouchGrass: [Queue] Stale tick_planned dropped: ${entry.id}`);
        continue;
      }
    }
    // --- Stale cleanup: date_planned whose slot passed more than WINDOW minutes ago ---
    if (entry.status === 'date_planned' && nowMinutes - entry.slotMinutes > WINDOW) {
      // DATE trigger fired natively (AlarmManager) or was missed — remove from queue
      console.log(`TouchGrass: [Queue] Stale date_planned dropped: ${entry.id}`);
      continue;
    }
    updatedQueue.push(entry);
  }

  saveQueue(updatedQueue);
}

/**
 * Schedule reminders for optimal times throughout the day.
 * Call this once at the start of each day to plan the day's reminders.
 * Records today's date in settings so the background task can call it
 * once per new day without re-planning on every run.
 */
export async function scheduleDayReminders(): Promise<void> {
  const todayStr = new Date().toDateString();
  const lastPlannedDate = getSetting('reminders_last_planned_date', '');
  if (lastPlannedDate === todayStr) {
    return;
  }

  // Mark planning as started BEFORE the first await so that concurrent callers
  // (e.g. foreground init and background task both waking at 3 AM) immediately
  // see today's date and return early rather than racing through the rest of
  // this function and scheduling duplicate notifications and calendar events.
  // JavaScript is single-threaded, so this assignment is visible to the next
  // synchronous caller that runs while this function is suspended at an await.
  setSetting('reminders_last_planned_date', todayStr);

  const remindersCount = parseInt(getSetting('smart_reminders_count', '2'), 10);

  // Always cancel stale failsafe reminders at the start of a new planning
  // cycle, regardless of whether reminders are enabled.  This clears out
  // any leftover failsafe triggers from the previous days before we either
  // skip (reminders=0 / goal reached) or schedule fresh ones.
  await cancelFailsafeReminders();

  // Delete stale failsafe calendar events created on a previous planning cycle
  // so they don't persist alongside the freshly planned events.
  deleteFutureTouchGrassEvents(new Date(), FAILSAFE_DAYS_AHEAD).catch((e) =>
    console.warn('TouchGrass: Failed to delete stale failsafe calendar events:', e),
  );

  if (remindersCount === 0) {
    setSetting('reminders_planned_slots', '[]');
    setSetting('additional_reminders_today', '0');
    setSetting('catchup_reminder_slot_minutes', '');
    return;
  }

  await cancelAutomaticReminders();

  const todayMinutes = getTodayMinutes();
  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;

  // Don't schedule reminders if daily goal is already reached
  if (todayMinutes >= dailyTarget) {
    setSetting('reminders_planned_slots', '[]');
    setSetting('additional_reminders_today', '0');
    setSetting('catchup_reminder_slot_minutes', '');
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Ensure weather data is current before scoring so that rain/sun forecasts
  // properly influence which slots are chosen.
  const weatherPrefs = getWeatherPreferences();
  if (weatherPrefs.enabled) {
    await fetchWeatherForecast({ allowPermissionPrompt: false });
  }

  const seenSlots = new Set<string>();
  const topSlots: Array<{ hour: number; minute: 0 | 30; contributors: ScoreContributor[] }> = [];
  const currentSlotMinutes = currentHour * 60 + currentMinute;

  // Pick slots one at a time. After each pick, re-score with the chosen slots as
  // plannedSlots so that the proximity penalty is applied to subsequent candidates,
  // discouraging reminders that are too close together.
  while (topSlots.length < remindersCount) {
    const scores = scoreReminderHours(
      todayMinutes,
      dailyTarget,
      currentHour,
      currentMinute,
      topSlots as Array<{ hour: number; minute: 0 | 30 }>,
    );

    let picked = false;
    for (const slot of scores) {
      if (slot.score < 0.4) continue;
      const slotMinutes = slot.hour * 60 + slot.minute;
      if (slotMinutes <= currentSlotMinutes) continue;

      const slotKey = `${slot.hour}:${slot.minute}`;
      if (seenSlots.has(slotKey)) continue;

      // Skip slots near user-defined scheduled notifications for today
      if (isSlotNearScheduledNotification(slot.hour, slot.minute, 30)) {
        console.log(`TouchGrass: Skipping reminder at ${slot.hour}:${slot.minute.toString().padStart(2, '0')} - scheduled notification nearby`);
        continue;
      }

      seenSlots.add(slotKey);
      topSlots.push({ hour: slot.hour, minute: slot.minute as 0 | 30, contributors: slot.contributors ?? [] });
      picked = true;
      break;
    }

    // No valid slot found in this round — stop looking
    if (!picked) break;
  }

  const scheduledSlots: Array<{ hour: number; minute: number }> = [];
  // Clear queue before rebuilding for the new day
  saveQueue([]);
  const newQueueEntries: ReminderQueueEntry[] = [];

  for (const slot of topSlots) {
    const triggerDate = new Date();
    triggerDate.setHours(slot.hour, slot.minute, 0, 0);

    const { title, body } = buildReminderMessage(todayMinutes, dailyTarget, slot.hour, slot.contributors);

    const dateKey = formatLocalDateKey(triggerDate);
    const id = `smart_${dateKey}_${slot.hour}:${String(slot.minute).padStart(2, '0')}`;

    await Notifications.scheduleNotificationAsync({
      identifier: id,
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

    scheduledSlots.push({ hour: slot.hour, minute: slot.minute });
    newQueueEntries.push({
      id,
      slotMinutes: slot.hour * 60 + slot.minute,
      status: 'date_planned',
    });

    // Add a future outdoor time slot to the calendar for each planned reminder
    maybeAddOutdoorTimeToCalendar(triggerDate).catch((e) =>
      console.warn('TouchGrass: Failed to add reminder slot to calendar:', e),
    );
  }

  // Store the planned slots so catch-up logic can reference them
  setSetting('reminders_planned_slots', JSON.stringify(scheduledSlots));
  setSetting('additional_reminders_today', '0');
  setSetting('catchup_reminder_slot_minutes', '');

  // Persist the queue for this day's planned slots
  saveQueue(newQueueEntries);

  // Pre-schedule the same time slots for the next FAILSAFE_DAYS_AHEAD days so
  // that reminders (and calendar events) fire even if the app is force-closed
  // and no JS runs at 3 AM.  When this function runs again on a future day,
  // deleteFutureTouchGrassEvents() will first remove the stale calendar events
  // before the fresh ones are created.
  await scheduleFailsafeReminders(topSlots);
}

/**
 * Schedule a catch-up reminder if the user is behind on their outdoor time goal.
 * Called from the background task after planned reminder times have passed.
 * The number of additional reminders per day is controlled by the
 * smart_catchup_reminders_count setting (0 = Off, 1 = Mellow, 2 = Medium, 3 = Aggressive).
 * These never create calendar events.
 */
export async function maybeScheduleCatchUpReminder(): Promise<void> {
  const remindersCount = parseInt(getSetting('smart_reminders_count', '2'), 10);
  if (remindersCount === 0) return;

  const todayStr = new Date().toDateString();
  const lastPlannedDate = getSetting('reminders_last_planned_date', '');
  if (lastPlannedDate !== todayStr) return;

  const additionalCount = parseInt(getSetting('additional_reminders_today', '0'), 10);
  const catchupLimit = parseInt(getSetting('smart_catchup_reminders_count', '2'), 10);
  if (additionalCount >= catchupLimit) return;

  // Load the planned slots for today
  let plannedSlots: Array<{ hour: number; minute: number }> = [];
  try {
    plannedSlots = JSON.parse(getSetting('reminders_planned_slots', '[]'));
  } catch {
    return;
  }
  if (plannedSlots.length === 0) return;

  const now = new Date();
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  // How many planned reminders have their time already passed?
  const passedCount = plannedSlots.filter(
    (s) => s.hour * 60 + s.minute <= currentMinutesOfDay,
  ).length;
  if (passedCount === 0) return;

  // Don't schedule a catch-up within 60 minutes of the last planned reminder —
  // give the user time to go outside before sending a follow-up.
  const mostRecentPassedMin = plannedSlots
    .map(s => s.hour * 60 + s.minute)
    .filter(m => m <= currentMinutesOfDay)
    .reduce((max, m) => Math.max(max, m), -1);
  if (mostRecentPassedMin >= 0 && currentMinutesOfDay - mostRecentPassedMin < 60) {
    console.log('TouchGrass: catch-up postponed — waiting 60 min after last planned reminder');
    return;
  }

  // % of planned reminders that have passed
  // remindersCount is guaranteed >= 1 (we returned early when it was 0)
  const passedPercent = passedCount / remindersCount;

  // % of daily target already reached
  const todayMinutes = getTodayMinutes();
  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;
  const targetPercent = Math.min(todayMinutes / dailyTarget, 1);

  // If the daily goal is already met, cancel any remaining smart reminders and stop.
  if (targetPercent >= 1) {
    console.log('TouchGrass: daily goal reached — cancelling remaining smart reminders (catch-up check)');
    await cancelAutomaticReminders();
    setSetting('reminders_planned_slots', '[]');
    setSetting('catchup_reminder_slot_minutes', '');
    return;
  }

  // Only schedule a catch-up if more reminders have passed than target % reached
  if (passedPercent <= targetPercent) return;

  // Find the best remaining future slot
  // Ensure weather data is current before scoring so catch-up picks the best
  // remaining slot accounting for current conditions.
  const weatherPrefs = getWeatherPreferences();
  if (weatherPrefs.enabled) {
    await fetchWeatherForecast({ allowPermissionPrompt: false });
  }
  const scores = scoreReminderHours(todayMinutes, dailyTarget, now.getHours(), now.getMinutes());
  const candidateSlots = scores.filter((s) => {
    const slotMin = s.hour * 60 + s.minute;
    return slotMin > currentMinutesOfDay
      && s.score >= 0.3
      && !isSlotNearScheduledNotification(s.hour, s.minute, 30);
  });

  if (candidateSlots.length === 0) return;

  // Take the top (remaining catch-ups) best-scored slots, then schedule the
  // earliest of those — this spreads reminders across the rest of the day and
  // leaves room in the day for subsequent catch-up reminders.
  const remainingCatchups = catchupLimit - additionalCount;
  const topCandidates = candidateSlots.slice(0, remainingCatchups);
  const best = topCandidates.reduce((earliest, s) =>
    s.hour * 60 + s.minute < earliest.hour * 60 + earliest.minute ? s : earliest
  );
  const triggerDate = new Date();
  triggerDate.setHours(best.hour, best.minute, 0, 0);

  const { title, body } = buildReminderMessage(todayMinutes, dailyTarget, best.hour, best.contributors ?? []);

  const dateKey = formatLocalDateKey(triggerDate);
  const id = `catchup_${dateKey}_${best.hour}:${String(best.minute).padStart(2, '0')}_${Date.now()}`;

  await Notifications.scheduleNotificationAsync({
    identifier: id,
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

  // Append catch-up entry to the queue
  const queue = getQueue();
  queue.push({
    id,
    slotMinutes: best.hour * 60 + best.minute,
    status: 'date_planned',
  });
  saveQueue(queue);

  // Additional reminders never create calendar events
  setSetting('additional_reminders_today', String(additionalCount + 1));
  setSetting('catchup_reminder_slot_minutes', String(best.hour * 60 + best.minute));
  console.log(
    `TouchGrass: catch-up reminder scheduled at ${best.hour}:${best.minute.toString().padStart(2, '0')}`,
  );
}

/**
 * Format a Date as a local-time YYYY-MM-DD key (used as part of failsafe
 * reminder identifiers).  Uses local date methods deliberately — toISOString()
 * returns UTC which can be a different date than the local calendar day near
 * midnight in non-zero UTC offsets.
 */
function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Cancel all failsafe reminder notifications that were pre-scheduled for
 * future days.  Called at the start of each new planning cycle so that stale
 * failsafe triggers from previous days are replaced with fresh ones.
 */
async function cancelFailsafeReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of all) {
    if (notif.identifier.startsWith(FAILSAFE_REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Pre-schedule "failsafe" DATE triggers for the same time slots on each of
 * the next FAILSAFE_DAYS_AHEAD days, and create a calendar event for each.
 *
 * Why: DATE triggers go through Android's AlarmManager and survive app
 * force-close.  If JS never runs at 3 AM (because registerTaskAsync only
 * works for remote FCM notifications, not local WEEKLY ones), these failsafe
 * triggers ensure the user still receives a reminder and sees planned outdoor
 * time in their calendar on the next day(s), at the previously calculated
 * optimal time.
 *
 * When the user opens the app, scheduleDayReminders() calls
 * deleteFutureTouchGrassEvents() to remove the stale calendar events, then
 * creates fresh ones after recalculating the optimal slots.
 *
 * @param slots  The time slots chosen by scheduleDayReminders() for today.
 */
async function scheduleFailsafeReminders(
  slots: Array<{ hour: number; minute: 0 | 30 }>,
): Promise<void> {
  if (slots.length === 0) return;

  const dailyTarget = getCurrentDailyGoal()?.targetMinutes ?? 30;

  for (let daysAhead = 1; daysAhead <= FAILSAFE_DAYS_AHEAD; daysAhead++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const dateKey = formatLocalDateKey(futureDate);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const triggerDate = new Date(futureDate);
      triggerDate.setHours(slot.hour, slot.minute, 0, 0);

      // Use 0 progress since we don't know tomorrow's outdoor minutes.
      const { title, body } = buildReminderMessage(0, dailyTarget, slot.hour);

      await Notifications.scheduleNotificationAsync({
        identifier: `${FAILSAFE_REMINDER_PREFIX}${dateKey}_${i}`,
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

      // Add a calendar event for this failsafe slot so the user sees planned
      // outdoor time even on days when the app was never opened.  When fresh
      // planning runs on that day, deleteFutureTouchGrassEvents() removes these
      // stale events before creating updated ones.
      maybeAddOutdoorTimeToCalendar(triggerDate).catch((e) =>
        console.warn('TouchGrass: Failed to add failsafe reminder slot to calendar:', e),
      );
    }
  }

  console.log(`TouchGrass: Failsafe reminders pre-scheduled for next ${FAILSAFE_DAYS_AHEAD} days`);
}

/**
 * Cancel only automatic/smart reminders for today, preserving scheduled
 * notifications, the daily planner wake-up notifications, and failsafe
 * reminders for future days.
 */
async function cancelAutomaticReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notif of all) {
    // Preserve:
    //  - scheduled notifications ('scheduled_' prefix)
    //  - the daily planner wake-up notifications (DAILY_PLANNER_NOTIF_PREFIX)
    //  - failsafe reminders for future days (FAILSAFE_REMINDER_PREFIX)
    if (
      !notif.identifier.startsWith('scheduled_') &&
      !notif.identifier.startsWith(DAILY_PLANNER_NOTIF_PREFIX) &&
      !notif.identifier.startsWith(FAILSAFE_REMINDER_PREFIX)
    ) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Handle user tapping a notification action button.
 */
async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
  const actionId = response.actionIdentifier;
  const notificationId = response.notification.request.identifier;
  const now = Date.now();
  const d = new Date(now);

  // Dismiss the notification from the tray so it doesn't linger after the user acts
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (e) {
    console.warn('TouchGrass: Failed to dismiss notification:', e);
  }

  // Daily planner notifications are not smart reminders — skip feedback tracking
  // so the reminder-learning algorithm is not corrupted by a 3 AM "dismissed" entry.
  if (notificationId.startsWith(DAILY_PLANNER_NOTIF_PREFIX)) {
    return;
  }

  const action = actionId === ACTION_WENT_OUTSIDE ? 'went_outside'
    : actionId === ACTION_SNOOZE ? 'snoozed'
    : actionId === ACTION_LESS_OFTEN ? 'less_often'
    : 'dismissed';

  // For 'less_often', feedback is NOT inserted immediately — the in-app modal lets
  // the user choose between "bad time" (inserts bad_time feedback) or
  // "fewer reminders" (adjusts settings). Dismissing the modal records nothing.
  if (action !== 'less_often') {
    insertReminderFeedback({
      timestamp: now,
      action,
      scheduledHour: d.getHours(),
      scheduledMinute: d.getMinutes() >= 30 ? 30 : 0,
      dayOfWeek: d.getDay(),
    });
  }

  if (action !== 'dismissed') {
    const confirmBodyKey = action === 'went_outside' ? 'notif_confirm_went_outside'
      : action === 'snoozed' ? 'notif_confirm_snoozed'
      : undefined;

    // Show an in-app modal instead of re-posting the notification
    triggerReminderFeedbackModal({
      action,
      hour: d.getHours(),
      minute: d.getMinutes(),
      ...(confirmBodyKey ? { confirmBodyKey } : {}),
    });
  }

  if (action === 'snoozed') {
    // Reschedule for SNOOZE_DURATION_MINUTES later
    const snoozeDate = new Date(now + SNOOZE_DURATION_MINUTES * 60 * 1000);
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
        seconds: SNOOZE_DURATION_MINUTES * 60,
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
  contributors?: ScoreContributor[],
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

  // Append top 2 contributor reason descriptions when available ("Why this time?" transparency)
  if (contributors && contributors.length > 0) {
    const top2 = contributors.slice(0, 2);
    const descriptions = top2.map((c) => c.description);
    const first = `${descriptions[0].charAt(0).toUpperCase()}${descriptions[0].slice(1)}`;
    if (descriptions.length === 1) {
      body += ` ${first}.`;
    } else {
      body += ` ${first}, and ${descriptions[1]}.`;
    }
  } else {
    // Fallback: add weather context if available and enabled (used when no contributors provided)
    if (isWeatherDataAvailable()) {
      const weatherPrefs = getWeatherPreferences();
      if (weatherPrefs.enabled) {
        const currentHour = hour ?? new Date().getHours();
        const weather = getWeatherForHour(currentHour);

        if (weather) {
          const emoji = getWeatherEmoji(weather);
          const temp = Math.round(weather.temperature);
          const desc = getWeatherDescription(weather);

          // Add weather hint to body
          body += ` ${emoji} ${desc}, ${temp}°C outside.`;
        }
      }
    }
  }

  return { title, body };
}
