/**
 * Timing constants and helpers for the Pulsar chained-alarm background system.
 *
 * The Pulsar architecture chains alarms: each JS pulse execution schedules the
 * next alarm via AlarmBridge.scheduleNextPulse(). This replaces the WorkManager-
 * based expo-background-task which gets cancelled by Android battery optimisation
 * after ~12 hours of no user interaction.
 */

import { scheduleNextPulse, cancelPulse } from 'alarm-bridge-native';

/** Alarm interval during active hours (06:00 – 00:00). */
export const PULSE_INTERVAL_DAY_MS = 15 * 60 * 1000; // 15 minutes

/** Alarm interval during overnight quiet hours (00:00 – 06:00). */
export const PULSE_INTERVAL_NIGHT_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Compute the delay until the next alarm pulse based on the current time.
 * Uses a longer interval overnight to reduce unnecessary wake-ups when
 * reminders would not fire anyway.
 */
export function computeNextSleepMs(now: Date = new Date()): number {
  const hour = now.getHours();
  return hour >= 0 && hour < 6 ? PULSE_INTERVAL_NIGHT_MS : PULSE_INTERVAL_DAY_MS;
}

/**
 * Schedule the next alarm pulse.
 * Idempotent — FLAG_UPDATE_CURRENT replaces any existing alarm so calling
 * this multiple times (e.g. on every foreground wake) is safe.
 */
export async function scheduleNextAlarmPulse(now?: Date): Promise<void> {
  const delayMs = computeNextSleepMs(now);
  await scheduleNextPulse(delayMs);
}

/** Cancel the pending alarm pulse. */
export { cancelPulse as cancelAlarmPulse };
