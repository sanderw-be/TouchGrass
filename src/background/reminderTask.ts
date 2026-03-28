import BackgroundActions from 'react-native-background-actions';
import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  scheduleNextReminder,
} from '../notifications/notificationManager';
import { getSetting } from '../storage/database';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// This is the entry point for the foreground service.
// It is called by react-native-background-actions and MUST loop indefinitely
// to keep the foreground service alive.
const reminderTask = async (taskData?: { delay?: number }): Promise<void> => {
  const delay = taskData?.delay ?? INTERVAL_MS;

  while (BackgroundActions.isRunning()) {
    try {
      console.log('TouchGrass: [BackgroundTask] Tick');
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

      console.log('TouchGrass: [BackgroundTask] Tick done');
    } catch (error) {
      console.error('TouchGrass: [BackgroundTask] Tick failed', error);
    }

    await sleep(delay);
  }
};

export default reminderTask;
