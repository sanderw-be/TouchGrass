import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Task name must match DailyPlannerHeadlessService.TASK_NAME on the native side.
// Deliberately NOT imported from modules/daily-planner-native to avoid triggering
// requireNativeModule() at bundle init time — the native module host may not be
// ready yet in a HeadlessJS context.
const DAILY_PLANNER_TASK_NAME = 'DailyPlannerTask';

// Register the HeadlessJS task that the native DailyPlannerWorker (WorkManager)
// and BootReceiver invoke at 3 AM or after a device reboot.  This bootstraps
// the React Native JS engine and runs the planning logic even when the app has
// been force-closed.
AppRegistry.registerHeadlessTask(DAILY_PLANNER_TASK_NAME, () => async () => {
  // Dynamic import keeps the critical path small when the full app isn't loaded.
  const { scheduleDayReminders } = await import('./src/notifications/notificationManager');
  const { scheduleAllScheduledNotifications } = await import('./src/notifications/scheduledNotifications');

  try {
    await scheduleDayReminders();
  } catch (e) {
    console.warn('DailyPlannerTask: scheduleDayReminders failed:', e);
  }

  try {
    await scheduleAllScheduledNotifications();
  } catch (e) {
    console.warn('DailyPlannerTask: scheduleAllScheduledNotifications failed:', e);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
