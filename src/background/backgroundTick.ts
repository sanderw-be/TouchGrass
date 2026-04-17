/**
 * Core background tick logic shared by both execution paths:
 *  - The Pulsar headless task (TOUCHGRASS_PULSE_TASK) — primary mechanism
 *  - The unified background task (TOUCHGRASS_UNIFIED_TASK) — WorkManager fallback
 *
 * Extracted intentionally so that behaviour is identical regardless of which
 * Android wake path is used.
 */

import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  processReminderQueue,
  logReminderQueueSnapshot,
  updateUpcomingReminderContent,
} from '../notifications/notificationManager';
import { fetchWeatherForecast } from '../weather/weatherService';
import { getSettingAsync, initDatabaseAsync, insertBackgroundLogAsync } from '../storage/database';

// ---------------------------------------------------------------------------
// Concurrency guard
// ---------------------------------------------------------------------------
// Prevents a Pulsar tick and a WorkManager tick from running the full
// background work simultaneously in the same JS runtime.
// JS is single-threaded, so the check+set before the first `await` is atomic.
let tickInProgress = false;

/**
 * Perform one background tick: weather refresh (optional) + reminder planning.
 *
 * Must be called with an active React Native JS runtime.
 * Safe to call from both HeadlessJsTask and WorkManager task callbacks.
 * If a tick is already running, the call returns immediately without doing any
 * work so the two execution paths never race each other.
 */
export async function performBackgroundTick(): Promise<void> {
  // Same-runtime concurrency guard: atomic check+set before the first await.
  if (tickInProgress) {
    console.log('TouchGrass: [BackgroundTick] Already running — skipping concurrent tick');
    await insertBackgroundLogAsync('reminder', 'Background tick skipped — already running');
    return;
  }
  tickInProgress = true;
  try {
    // Ensure DB schema and defaults are in place — the background runtime has
    // no guarantee that App.tsx has run first.
    await initDatabaseAsync();

    await insertBackgroundLogAsync('reminder', 'Background tick start');

    // --- Weather refresh (runs first to warm the 30-min cache) ---
    // scheduleDayReminders and maybeScheduleCatchUpReminder both call
    // fetchWeatherForecast internally; by fetching once up-front they get an
    // instant cache-hit instead of each making their own network round-trip.
    const weatherEnabled = (await getSettingAsync('weather_enabled', '1')) === '1';
    if (weatherEnabled) {
      try {
        await fetchWeatherForecast({ allowPermissionPrompt: false });
        await insertBackgroundLogAsync('reminder', 'Weather refresh succeeded');
      } catch (weatherError) {
        console.error('TouchGrass: [BackgroundTick] Weather fetch failed', weatherError);
        await insertBackgroundLogAsync('reminder', 'Weather refresh failed');
      }
    } else {
      await insertBackgroundLogAsync('reminder', 'Weather disabled — skipping refresh');
    }

    // --- Reminder planning ---
    const remindersCountRaw = await getSettingAsync('smart_reminders_count', '0');
    const remindersEnabled = parseInt(remindersCountRaw, 10) > 0;
    console.log(
      `TouchGrass: [BackgroundTick] smart_reminders_count=${remindersCountRaw} → reminders ${remindersEnabled ? 'enabled' : 'disabled'}`
    );
    if (remindersEnabled) {
      logReminderQueueSnapshot();
      try {
        await scheduleDayReminders();
        await processReminderQueue(); // update consumed states before catch-up check
        await updateUpcomingReminderContent(); // update notification content if < 30 min away
        await maybeScheduleCatchUpReminder(); // uses consumed entries for 60-min wait guard
      } catch (reminderError) {
        console.error('TouchGrass: [BackgroundTick] Reminder operations failed', reminderError);
      }
    } else {
      await insertBackgroundLogAsync(
        'reminder',
        'Reminders disabled — skipping background tick work'
      );
    }

    await insertBackgroundLogAsync('reminder', 'Background tick done');
  } finally {
    tickInProgress = false;
  }
}
