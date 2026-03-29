/**
 * Shared slot-timing helpers for the Pulsar alarm chain.
 *
 * Extracted here so both reminderTask.ts (foreground service path) and
 * backgroundTick.ts (HeadlessJS path) can import them without creating a
 * circular dependency.
 */

// How many minutes before a planned slot we want to wake up and check whether
// the daily goal was already reached (so we can cancel the reminder on time).
export const LEAD_MINUTES = 5;

// How long after a planned reminder fires before we are allowed to schedule a
// catch-up reminder.  The background task adds a virtual "check" slot at
// lastPlannedSlot + CATCHUP_WAIT_MINUTES so it wakes up at the right time.
export const CATCHUP_WAIT_MINUTES = 60;

// Fallback used when the planned-slots data is unavailable or parsing fails.
export const FALLBACK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Convenience constant used when converting between milliseconds and minutes.
export const MS_PER_MINUTE = 60_000;

/**
 * Compute the duration (ms) until the next scheduled reminder slot.
 *
 * Used to determine when to schedule the next AlarmManager pulse. Not used
 * for sleeping inside a service loop — the shortService architecture stops
 * the service after each tick and relies on external triggers for the next run.
 *
 * Strategy:
 * 1. Combine planned slots and the scheduled catch-up slot into one list, then
 *    return the duration until LEAD_MINUTES before the next upcoming slot in
 *    that combined list.  This ensures a catch-up slot that falls between two
 *    planned slots is not skipped.
 * 2. When no catch-up is scheduled yet but a planned slot fired recently
 *    (< CATCHUP_WAIT_MINUTES ago), add a virtual "check" slot at
 *    lastPlannedSlot + CATCHUP_WAIT_MINUTES.  This gives the user time to go
 *    outside after a planned reminder before deciding whether to schedule a
 *    catch-up.
 * 3. No upcoming slot of any kind — return duration until midnight so the next
 *    tick only needs to happen once for the next day's planning.
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
    // Wake up at LEAD_MINUTES before the slot; at least 1 minute from now.
    const sleepMinutes = Math.max(minutesUntilSlot - LEAD_MINUTES, 1);
    return sleepMinutes * 60 * 1000;
  }

  // No upcoming slot of any kind — return duration until midnight.
  return msUntilMidnight(now);
}

export function msUntilMidnight(now: Date): number {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  // Always return at least 1 minute to avoid a tight busy-loop near midnight.
  return Math.max(tomorrow.getTime() - now.getTime(), 60 * 1000);
}
