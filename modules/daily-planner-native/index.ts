import { Platform } from 'react-native';
import DailyPlannerNativeModule from './src/DailyPlannerNativeModule';

/**
 * Schedule the native WorkManager job that fires at ~3 AM daily.
 * The worker starts a HeadlessJS task (`DailyPlannerTask`) which runs
 * the smart-reminder planning logic even when the app is force-closed.
 *
 * Android-only — no-op on other platforms.
 */
export async function scheduleDailyPlanner(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await DailyPlannerNativeModule.scheduleDailyPlanner();
}

/**
 * Cancel the native WorkManager daily planner job.
 *
 * Android-only — no-op on other platforms.
 */
export async function cancelDailyPlanner(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await DailyPlannerNativeModule.cancelDailyPlanner();
}

/**
 * Schedule an exact alarm at the given hour and minute using
 * `AlarmManager.setExactAndAllowWhileIdle()`.
 *
 * @param id      Unique integer identifier for this alarm (used to cancel).
 * @param hour    Hour of day (0–23).
 * @param minute  Minute (0–59).
 * @returns `true` if the alarm was successfully set.
 *
 * Android-only — returns `false` on other platforms.
 */
export async function scheduleExactAlarm(
  id: number,
  hour: number,
  minute: number,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return DailyPlannerNativeModule.scheduleExactAlarm(id, hour, minute);
}

/**
 * Cancel an exact alarm previously scheduled with {@link scheduleExactAlarm}.
 *
 * Android-only — no-op on other platforms.
 */
export async function cancelExactAlarm(id: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  await DailyPlannerNativeModule.cancelExactAlarm(id);
}

/**
 * Check whether the app is currently exempt from Android's battery
 * optimization (Doze / App Standby).
 *
 * @returns `true` if the app is whitelisted. Always returns `false` on
 * non-Android platforms.
 */
export function isBatteryOptimizationIgnored(): boolean {
  if (Platform.OS !== 'android') return false;
  return DailyPlannerNativeModule.isBatteryOptimizationIgnored();
}

/**
 * Open the system dialog that lets the user exempt this app from battery
 * optimizations.  This is the
 * `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` intent.
 *
 * Android-only — no-op on other platforms.
 */
export function requestIgnoreBatteryOptimizations(): void {
  if (Platform.OS !== 'android') return;
  DailyPlannerNativeModule.requestIgnoreBatteryOptimizations();
}

/** Name of the HeadlessJS task registered on the JS side. */
export const HEADLESS_TASK_NAME = 'DailyPlannerTask';
