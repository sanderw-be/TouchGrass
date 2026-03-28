import BackgroundActions from 'react-native-background-actions';
import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  scheduleNextReminder,
} from '../notifications/notificationManager';
import { getSetting } from '../storage/database';

// How many minutes before a planned slot we want to wake up and check whether
// the daily goal was already reached (so we can cancel the reminder on time).
const LEAD_MINUTES = 5;

// After all planned slots have passed we still check periodically in case a
// catch-up reminder needs to be scheduled.
const CATCHUP_WINDOW_MINUTES = 120; // 2 hours
const CATCHUP_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Fallback used when the planned-slots data is unavailable or parsing fails.
const FALLBACK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Compute the optimal sleep duration (ms) before the next background-task tick.
 *
 * Adaptive, event-driven strategy that minimises active running:
 * 1. There is an upcoming planned slot  → sleep until LEAD_MINUTES before it,
 *    so we can cancel the notification if the daily goal was already met.
 * 2. All planned slots have passed, but we are still within CATCHUP_WINDOW_MINUTES
 *    of the last one → poll every CATCHUP_CHECK_INTERVAL_MS to schedule catch-up
 *    reminders as soon as they are needed.
 * 3. No planned slots for today, or past the catch-up window → sleep until
 *    midnight so the service only wakes up once for the next day's planning.
 */
export function computeNextSleepMs(
  plannedSlots: Array<{ hour: number; minute: number }>,
  now: Date,
): number {
  if (plannedSlots.length === 0) {
    return msUntilMidnight(now);
  }

  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  const sorted = [...plannedSlots].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
  );

  // Find the next upcoming planned slot
  const nextSlot = sorted.find((s) => s.hour * 60 + s.minute > currentMinutesOfDay);

  if (nextSlot) {
    const minutesUntilSlot = nextSlot.hour * 60 + nextSlot.minute - currentMinutesOfDay;
    // Sleep until LEAD_MINUTES before the slot; wake up at least 1 minute from now.
    const sleepMinutes = Math.max(minutesUntilSlot - LEAD_MINUTES, 1);
    return sleepMinutes * 60 * 1000;
  }

  // All planned slots have passed — are we still within the catch-up window?
  const lastSlot = sorted[sorted.length - 1];
  const minutesSinceLastSlot = currentMinutesOfDay - (lastSlot.hour * 60 + lastSlot.minute);

  if (minutesSinceLastSlot < CATCHUP_WINDOW_MINUTES) {
    return CATCHUP_CHECK_INTERVAL_MS;
  }

  // Past the catch-up window — sleep until midnight.
  return msUntilMidnight(now);
}

function msUntilMidnight(now: Date): number {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  // Always sleep at least 1 minute to avoid a tight busy-loop near midnight.
  return Math.max(tomorrow.getTime() - now.getTime(), 60 * 1000);
}

// This is the entry point for the foreground service.
// It is called by react-native-background-actions and MUST loop indefinitely
// to keep the foreground service alive.
const reminderTask = async (): Promise<void> => {
  while (BackgroundActions.isRunning()) {
    try {
      console.log('TouchGrass: [BackgroundTask] Tick');
      const todayStr = new Date().toDateString();
      const lastPlannedDate = getSetting('reminders_last_planned_date', '');

      // 1. Perform daily planning if it has not been done today.
      if (lastPlannedDate !== todayStr) {
        await scheduleDayReminders();
      }

      // 2. Check for and schedule any necessary catch-up reminders.
      await maybeScheduleCatchUpReminder();

      // 3. Perform an ad-hoc check for an immediate reminder.
      await scheduleNextReminder();

      console.log('TouchGrass: [BackgroundTask] Tick done');
    } catch (error) {
      console.error('TouchGrass: [BackgroundTask] Tick failed', error);
    }

    // Compute a dynamic sleep duration based on the planned reminder slots so
    // the service does the minimum amount of active work.
    let sleepMs = FALLBACK_INTERVAL_MS;
    try {
      const raw = getSetting('reminders_planned_slots', '[]');
      const slots = JSON.parse(raw) as Array<{ hour: number; minute: number }>;
      sleepMs = computeNextSleepMs(slots, new Date());
    } catch (e) {
      // Parsing failed; fall back to the fixed interval.
      console.warn('TouchGrass: [BackgroundTask] Failed to compute dynamic sleep interval:', e);
    }

    console.log(
      `TouchGrass: [BackgroundTask] Sleeping for ${Math.round(sleepMs / 1000 / 60)} min`,
    );
    await sleep(sleepMs);
  }
};

export default reminderTask;
