/**
 * Entry point for the shortService foreground service
 * (react-native-background-actions / RNBackgroundActionsTask).
 *
 * Performs one tick via performBackgroundTick() — which does daily planning,
 * catch-up scheduling, and chains the next AlarmManager pulse — then stops
 * the service.  shortService has no cumulative quota, only a ~3-minute
 * per-run hard limit; stopping after a single tick ensures we never hit it.
 *
 * computeNextSleepMs is re-exported from alarmTiming.ts so that the existing
 * unit tests (which import it from this module) continue to work without
 * modification.
 */

import BackgroundActions from 'react-native-background-actions';
import { performBackgroundTick } from './backgroundTick';

// Re-export for backwards-compatibility with existing unit tests.
export { computeNextSleepMs } from './alarmTiming';

const reminderTask = async (): Promise<void> => {
  try {
    await performBackgroundTick();
  } finally {
    // Stop the service. shortService must not run longer than ~3 minutes.
    await BackgroundActions.stop();
  }
};

export default reminderTask;
