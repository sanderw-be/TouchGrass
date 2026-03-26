import { requireNativeModule } from 'expo-modules-core';

/**
 * The native DailyPlannerNative module provides Android-specific APIs for:
 * - WorkManager scheduling (3 AM daily planner)
 * - Exact alarms via AlarmManager
 * - Battery optimization status and requests
 */
export default requireNativeModule('DailyPlannerNative');
