import { AppRegistry, NativeModules } from 'react-native';
import * as Notifications from 'expo-notifications';
import { computeNextSleepMs } from './reminderTask';
import { getSetting } from '../storage/database';
import {
    scheduleDayReminders,
    maybeScheduleCatchUpReminder,
    scheduleNextReminder,
} from '../notifications/notificationManager';

const { AlarmScheduler } = NativeModules;

const ReminderHeadlessTask = async (taskData: any) => {
    try {
        console.log("Pulsar: Checking schedule...");

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

        // 4. Calculate the NEXT moment
        let sleepMs = 15 * 60 * 1000; // 15 minutes fallback
        try {
            const raw = getSetting('reminders_planned_slots', '[]');
            const slots = JSON.parse(raw) as Array<{ hour: number; minute: number }>;

            const catchupRaw = getSetting('catchup_reminder_slot_minutes', '');
            const catchupTotalMinutes = catchupRaw !== '' ? parseInt(catchupRaw, 10) : NaN;
            const catchupSlot = !isNaN(catchupTotalMinutes)
                ? { hour: Math.floor(catchupTotalMinutes / 60), minute: catchupTotalMinutes % 60 }
                : null;

            sleepMs = computeNextSleepMs(slots, catchupSlot, new Date());
        } catch (e) {
            // Parsing failed; fall back to the fixed interval.
            console.warn('TouchGrass: [Pulsar] Failed to compute dynamic sleep interval:', e);
        }

        const nextTime = new Date(Date.now() + sleepMs);

        // 5. Chain the next alarm
        if (AlarmScheduler && AlarmScheduler.scheduleNextAlarm) {
            AlarmScheduler.scheduleNextAlarm(nextTime.getTime());
            console.log(`Pulsar: Scheduled next alarm for ${nextTime}`);
        } else {
            console.error("Pulsar: AlarmScheduler native module is not available.");
        }

        // 6. Send the actual notification if required (the functions above will do this)

    } catch (error) {
        console.error("Pulsar: error", error);
    }
};

AppRegistry.registerHeadlessTask('ReminderHeadlessTask', () => ReminderHeadlessTask);
