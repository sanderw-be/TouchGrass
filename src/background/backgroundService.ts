import BackgroundJob from 'react-native-background-actions';
import veryIntensiveTask from './reminderTask';
import { t } from '../i18n';

const options = {
    taskName: 'TouchGrassReminder',
    taskTitle: t('background_task_title'), // e.g., 'Smart Reminders'
    taskDesc: t('background_task_desc'),   // e.g., 'Checking for the best time to remind you.'
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#4A7C59',
    linkingURI: 'touchgrass://', // Optional: This will be opened when the user taps on the notification.
    parameters: {
        delay: 1000,
    },
};

export const startBackgroundTask = async () => {
    // Android Only: Check if the task is already running
    if (BackgroundJob.isRunning()) {
        console.log('TouchGrass: [BackgroundTask] Already running, not starting again.');
        return;
    }
    try {
        console.log('TouchGrass: [BackgroundTask] Starting...');
        // Start the background job
        await BackgroundJob.start(veryIntensiveTask, options);
        console.log('TouchGrass: [BackgroundTask] Started successfully.');
    } catch (e) {
        console.error('TouchGrass: [BackgroundTask] Failed to start.', e);
    }
};

export const stopBackgroundTask = async () => {
    if (!BackgroundJob.isRunning()) {
        return;
    }
    console.log('TouchGrass: [BackgroundTask] Stopping...');
    await BackgroundJob.stop();
};
