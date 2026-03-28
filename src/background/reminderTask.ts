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

// How long after a planned reminder fires before we are allowed to schedule a
// catch-up reminder.  The background task adds a virtual "check" slot at
// lastPlannedSlot + CATCHUP_WAIT_MINUTES so it wakes up at the right time.
const CATCHUP_WAIT_MINUTES = 60;

// Fallback used when the planned-slots data is unavailable or parsing fails.
const FALLBACK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Compute the optimal sleep duration (ms) before the next background-task tick.
 *
 * Adaptive, event-driven strategy that minimises active running:
 * 1. Combine planned slots and the scheduled catch-up slot into one list, then
 *    sleep until LEAD_MINUTES before the next upcoming slot in that combined
 *    list.  This ensures a catch-up slot that falls between two planned slots
 *    is not skipped.
 * 2. When no catch-up is scheduled yet but a planned slot fired recently
 *    (< CATCHUP_WAIT_MINUTES ago), add a virtual "check" slot at
 *    lastPlannedSlot + CATCHUP_WAIT_MINUTES.  This gives the user time to go
 *    outside after a planned reminder before the background task decides
 *    whether to schedule a catch-up.
 * 3. No upcoming slot of any kind — sleep until midnight so the service only
 *    wakes up once for the next day's planning.
 */
export function computeNextSleepMs(
  plannedSlots: Array<{ hour: number; minute: number }>,
  catchupSlot: { hour: number; minute: number } | null,
  now: Date,
): number {
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  // Build a combined list of all upcoming reminder slots (planned + catch-up).
  const allSlots: Array<{ hour: number; minute: number }> = [...plannedSlots];

  if (catchupSlot !== null) {
    // Include the scheduled catch-up slot so we wake up before it fires even
    // if a later planned slot exists.
    allSlots.push(catchupSlot);
  } else {
    // No catch-up is scheduled yet.  If a planned slot fired recently
    // (< CATCHUP_WAIT_MINUTES ago), add a virtual "check" slot at
    // mostRecentPassed + CATCHUP_WAIT_MINUTES.  The background task will wake
    // up at that point and run maybeScheduleCatchUpReminder() to decide whether
    // a catch-up is needed.
    const passedSlotMinutes = plannedSlots
      .map(s => s.hour * 60 + s.minute)
      .filter(m => m <= currentMinutesOfDay);
    if (passedSlotMinutes.length > 0) {
      const mostRecentPassed = Math.max(...passedSlotMinutes);
      const checkAt = mostRecentPassed + CATCHUP_WAIT_MINUTES;
      if (checkAt > currentMinutesOfDay) {
        allSlots.push({ hour: Math.floor(checkAt / 60), minute: checkAt % 60 });
      }
    }
  }

  // Find the next upcoming slot among all combined slots.
  const sorted = [...allSlots].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
  );
  const nextSlot = sorted.find((s) => s.hour * 60 + s.minute > currentMinutesOfDay);

  if (nextSlot) {
    const minutesUntilSlot = nextSlot.hour * 60 + nextSlot.minute - currentMinutesOfDay;
    // Sleep until LEAD_MINUTES before the slot; wake up at least 1 minute from now.
    const sleepMinutes = Math.max(minutesUntilSlot - LEAD_MINUTES, 1);
    return sleepMinutes * 60 * 1000;
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
