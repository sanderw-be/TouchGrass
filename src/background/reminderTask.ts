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

// Fallback used when the planned-slots data is unavailable or parsing fails.
const FALLBACK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Compute the optimal sleep duration (ms) before the next background-task tick.
 *
 * Adaptive, event-driven strategy that minimises active running:
 * 1. There is an upcoming planned slot  → sleep until LEAD_MINUTES before it,
 *    so we can cancel the notification if the daily goal was already met.
 * 2. All planned slots have passed and a catch-up reminder is scheduled → sleep
 *    until LEAD_MINUTES before that catch-up slot, so we can cancel it if the
 *    daily goal was already met by then.
 * 3. No planned slots today, or all slots have passed with no catch-up scheduled
 *    → sleep until midnight so the service only wakes up once for the next day's
 *    planning.
 */
export function computeNextSleepMs(
  plannedSlots: Array<{ hour: number; minute: number }>,
  catchupSlot: { hour: number; minute: number } | null,
  now: Date,
): number {
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  if (plannedSlots.length > 0) {
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
  }

  // All planned slots have passed (or there were none).
  // If a catch-up reminder has been scheduled, sleep until just before it fires
  // so we can cancel it if the daily goal has since been reached.
  if (catchupSlot !== null) {
    const catchupMinutesOfDay = catchupSlot.hour * 60 + catchupSlot.minute;
    if (catchupMinutesOfDay > currentMinutesOfDay) {
      const minutesUntilCatchup = catchupMinutesOfDay - currentMinutesOfDay;
      const sleepMinutes = Math.max(minutesUntilCatchup - LEAD_MINUTES, 1);
      return sleepMinutes * 60 * 1000;
    }
  }

  // No upcoming slot of any kind — sleep until midnight.
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

      const catchupRaw = getSetting('catchup_reminder_slot_minutes', '');
      const catchupTotalMinutes = catchupRaw !== '' ? parseInt(catchupRaw, 10) : NaN;
      const catchupSlot = !isNaN(catchupTotalMinutes)
        ? { hour: Math.floor(catchupTotalMinutes / 60), minute: catchupTotalMinutes % 60 }
        : null;

      sleepMs = computeNextSleepMs(slots, catchupSlot, new Date());
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
