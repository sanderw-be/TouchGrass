jest.mock('../storage/database');
jest.mock('../notifications/notificationManager');
jest.mock('../weather/weatherService');
jest.mock('./healthConnect', () => ({}), { virtual: true });
jest.mock('../detection/healthConnect', () => ({
  syncHealthConnect: jest.fn().mockResolvedValue(true),
  isHealthConnectAvailable: jest.fn().mockResolvedValue(false),
  requestHealthPermissions: jest.fn().mockResolvedValue(false),
  openHealthConnectForManagement: jest.fn().mockResolvedValue(false),
}));
jest.mock('../detection/healthConnectIntent', () => ({
  verifyHealthConnectPermissions: jest.fn().mockResolvedValue(false),
}));
jest.mock('../detection/gpsDetection', () => ({
  startLocationTracking: jest.fn().mockResolvedValue(undefined),
  autoDetectLocations: jest.fn().mockResolvedValue(undefined),
}));

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Database from '../storage/database';
import * as NotificationManager from '../notifications/notificationManager';
import * as WeatherService from '../weather/weatherService';

// Import the module to register the background task
import * as Detection from '../detection/index';

describe('detection background task', () => {
  let taskCallback: (...args: any[]) => Promise<any>;

  beforeAll(() => {
    const call = (TaskManager.defineTask as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === 'TOUCHGRASS_BACKGROUND_TASK'
    );
    taskCallback = call?.[1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => fallback);
    (NotificationManager.scheduleNextReminder as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });
  });

  it('defines the TOUCHGRASS_BACKGROUND_TASK on module load', () => {
    expect(taskCallback).toBeDefined();
  });

  it('calls scheduleDayReminders when reminders_last_planned_date is a different day', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'reminders_last_planned_date') return 'Mon Jan 01 2024'; // yesterday
      return fallback;
    });

    const result = await taskCallback();

    expect(NotificationManager.scheduleDayReminders).toHaveBeenCalledTimes(1);
    expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
  });

  it('does not call scheduleDayReminders when reminders_last_planned_date matches today', async () => {
    const today = new Date().toDateString();
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'reminders_last_planned_date') return today;
      return fallback;
    });

    await taskCallback();

    expect(NotificationManager.scheduleDayReminders).not.toHaveBeenCalled();
  });

  it('always calls scheduleNextReminder regardless of day planning', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => fallback);

    await taskCallback();

    expect(NotificationManager.scheduleNextReminder).toHaveBeenCalledTimes(1);
  });

  it('returns Success on successful run', async () => {
    const result = await taskCallback();
    expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
  });

  it('returns Failed on unexpected error', async () => {
    (NotificationManager.scheduleNextReminder as jest.Mock).mockRejectedValue(
      new Error('Unexpected error')
    );

    const result = await taskCallback();

    expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
  });

  describe('registerBackgroundTask', () => {
    it('registers the task with a 15 minute interval when not registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await Detection.initDetection();

      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
        'TOUCHGRASS_BACKGROUND_TASK',
        { minimumInterval: 15 }
      );
    });

    it('does not register the task when already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await Detection.initDetection();

      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });
  });
});
