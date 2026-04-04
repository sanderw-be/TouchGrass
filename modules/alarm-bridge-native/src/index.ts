import { NativeModules, Platform } from 'react-native';

// The native module is registered by AlarmBridgePackage (added to MainApplication
// via withAlarmBridgePlugin). It is Android-only; return no-ops on other platforms.
const { AlarmBridgeNative } = NativeModules;

/** Task name used by AlarmPulseService and AppRegistry.registerHeadlessTask(). */
export const PULSE_TASK_NAME = 'TOUCHGRASS_PULSE_TASK';

/**
 * Schedule the next Pulsar alarm to fire after `delayMs` milliseconds.
 * Uses setExactAndAllowWhileIdle — fires even during Doze mode.
 * Replaces any existing pending alarm (FLAG_UPDATE_CURRENT).
 */
export async function scheduleNextPulse(delayMs: number): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmBridgeNative) return;
  return AlarmBridgeNative.scheduleNextPulse(delayMs);
}

/**
 * Cancel the pending Pulsar alarm, if any.
 * Call when the user disables all background features.
 */
export async function cancelPulse(): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmBridgeNative) return;
  return AlarmBridgeNative.cancelPulse();
}
