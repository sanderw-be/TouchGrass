import { requireNativeModule } from 'expo-modules-core';

interface AlarmBridgeNativeModule {
  scheduleNextPulse(timestampMs: number): void;
}

/**
 * Schedule an exact AlarmManager alarm that will wake the device and trigger
 * the JS PulseTask (via AlarmPulseService) at the given epoch timestamp.
 *
 * Uses AlarmManager.setExactAndAllowWhileIdle so it fires even during Doze.
 *
 * NOTE: Always use lazy requireNativeModule() inside functions – never at
 * module scope – to avoid [runtime not ready] crashes in HeadlessJS context.
 */
export function scheduleNextPulse(timestampMs: number): void {
  const m = requireNativeModule<AlarmBridgeNativeModule>('AlarmBridgeNative');
  m.scheduleNextPulse(timestampMs);
}
