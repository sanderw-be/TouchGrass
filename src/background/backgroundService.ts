import BackgroundJob from 'react-native-background-actions';
import reminderTask from './reminderTask';
import { t } from '../i18n';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const options = {
    taskName: 'TouchGrassReminder',
    taskTitle: t('background_task_title'),
    taskDesc: t('background_task_desc'),
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#4A7C59',
    linkingURI: 'touchgrass://',
    parameters: {
        delay: INTERVAL_MS,
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
        await BackgroundJob.start(reminderTask, options);
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
