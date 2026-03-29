/**
 * Core background tick: performs one round of reminder scheduling and then
 * chains the next AlarmManager pulse.
 *
 * Called from two paths:
 *   1. Foreground service path  — reminderTask.ts (react-native-background-actions)
 *   2. HeadlessJS path          — PulseTask registered in index.ts
 *
 * Using requireNativeModule() lazily (inside the function) avoids the
 * "[runtime not ready]" crash that occurs when native modules are accessed
 * before the React Native bridge is fully initialised in the HeadlessJS
 * context.
 */

import { requireNativeModule } from 'expo-modules-core';
import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  scheduleNextReminder,
} from '../notifications/notificationManager';
import { getSetting } from '../storage/database';
import { computeNextSleepMs, FALLBACK_INTERVAL_MS, MS_PER_MINUTE } from './alarmTiming';

interface AlarmBridgeNativeModule {
  scheduleNextPulse(timestampMs: number): void;
}

export async function performBackgroundTick(): Promise<void> {
  try {
    console.log('TouchGrass: [BackgroundTick] Tick');
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

    console.log('TouchGrass: [BackgroundTick] Tick done');
  } catch (error) {
    console.error('TouchGrass: [BackgroundTick] Tick failed', error);
  } finally {
    scheduleNextAlarmPulse();
  }
}

function scheduleNextAlarmPulse(): void {
  try {
    const raw = getSetting('reminders_planned_slots', '[]');
    const slots = JSON.parse(raw) as Array<{ hour: number; minute: number }>;

    const catchupRaw = getSetting('catchup_reminder_slot_minutes', '');
    const catchupTotalMinutes = catchupRaw !== '' ? parseInt(catchupRaw, 10) : NaN;
    const catchupSlot = !isNaN(catchupTotalMinutes)
      ? { hour: Math.floor(catchupTotalMinutes / 60), minute: catchupTotalMinutes % 60 }
      : null;

    const nextMs = computeNextSleepMs(slots, catchupSlot, new Date());
    const alarmBridge =
      requireNativeModule<AlarmBridgeNativeModule>('AlarmBridgeNative');
    alarmBridge.scheduleNextPulse(Date.now() + nextMs);

    console.log(
      `TouchGrass: [BackgroundTick] Next pulse in ${Math.round(nextMs / MS_PER_MINUTE)} min`,
    );
  } catch (e) {
    // If AlarmBridgeNative is not available (e.g. in tests or on iOS) or the
    // slot data is malformed, fall back gracefully and log a warning.
    console.warn('TouchGrass: [BackgroundTick] Failed to schedule next pulse:', e);
  }
}
