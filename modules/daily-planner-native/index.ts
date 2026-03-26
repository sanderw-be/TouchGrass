import { requireNativeModule, Platform } from 'expo-modules-core';

export const HEADLESS_TASK_NAME = 'DailyPlannerTask';

// Lazy accessor – avoids crashing when the native runtime is not yet ready
// (e.g. in HeadlessJS context or unit tests).
function getNativeModule(): any {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule('DailyPlannerNative');
  } catch {
    return null;
  }
}

export async function scheduleDailyPlanner(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  await mod.scheduleDailyPlanner();
}

export async function cancelDailyPlanner(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  await mod.cancelDailyPlanner();
}

export async function scheduleExactAlarm(hour: number, minute: number): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  await mod.scheduleExactAlarm(hour, minute);
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.requestIgnoreBatteryOptimizations();
}
