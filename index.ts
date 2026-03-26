import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';

import App from './App';

// Headless JS task name – duplicated as a plain string to avoid importing the
// native module barrel (which may crash in a headless JS context before the
// Expo runtime is ready).
const DAILY_PLANNER_TASK = 'DailyPlannerTask';

AppRegistry.registerHeadlessTask(DAILY_PLANNER_TASK, () => async () => {
  console.log('TouchGrass: HeadlessJS DailyPlannerTask running');
  try {
    const { scheduleDayReminders } = await import('./src/notifications/notificationManager');
    await scheduleDayReminders();
  } catch (e) {
    console.warn('TouchGrass: HeadlessJS scheduleDayReminders failed:', e);
  }
  try {
    const { scheduleAllScheduledNotifications } = await import('./src/notifications/scheduledNotifications');
    await scheduleAllScheduledNotifications();
  } catch (e) {
    console.warn('TouchGrass: HeadlessJS scheduleAllScheduledNotifications failed:', e);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
