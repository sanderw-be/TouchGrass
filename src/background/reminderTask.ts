import {
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  scheduleNextReminder,
} from '../notifications/notificationManager';
import { getSetting } from '../storage/database';

// This is the entry point for the background task.
// It is called by the native Android side (via react-native-background-actions).
const veryIntensiveTask = async (taskData?: { [key: string]: any }): Promise<void> => {
    await new Promise( async (resolve) => {
        try {
            console.log('TouchGrass: [BackgroundTask] Task running');
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

            console.log('TouchGrass: [BackgroundTask] Task finished');
        } catch (error) {
            console.error('TouchGrass: [BackgroundTask] Task failed', error);
        } finally {
            resolve();
        }
    });
};

export default veryIntensiveTask;
