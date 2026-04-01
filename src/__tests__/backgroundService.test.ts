/**
 * Tests for the unified background task (replaces the old backgroundService tests).
 * The legacy react-native-background-actions foreground service has been replaced
 * by a single expo-background-task that handles both reminders and weather.
 */

jest.mock('../notifications/notificationManager', () => ({
  scheduleDayReminders: jest.fn(),
  maybeScheduleCatchUpReminder: jest.fn(),
  processReminderQueue: jest.fn(),
  logReminderQueueSnapshot: jest.fn(),
}));

jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(),
}));

jest.mock('../storage/database', () => ({
  getSetting: jest.fn(),
  initDatabase: jest.fn(),
}));

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as NotificationManager from '../notifications/notificationManager';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage/database';
import {
  UNIFIED_BACKGROUND_TASK,
  registerUnifiedBackgroundTask,
  unregisterUnifiedBackgroundTask,
} from '../background/unifiedBackgroundTask';

describe('unifiedBackgroundTask', () => {
  // Capture the task callback registered at module load time
  let taskCallback: (...args: any[]) => Promise<any>;

  beforeAll(() => {
    const call = (TaskManager.defineTask as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === UNIFIED_BACKGROUND_TASK,
    );
    taskCallback = call?.[1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUnifiedBackgroundTask', () => {
    it('registers the task when not already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await registerUnifiedBackgroundTask();

      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
        UNIFIED_BACKGROUND_TASK,
        { minimumInterval: 15 },
      );
    });

    it('does not register the task when already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await registerUnifiedBackgroundTask();

      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it('handles registration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
      (BackgroundTask.registerTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Registration failed'),
      );

      await expect(registerUnifiedBackgroundTask()).resolves.not.toThrow();
    });
  });

  describe('unregisterUnifiedBackgroundTask', () => {
    it('unregisters the task when registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await unregisterUnifiedBackgroundTask();

      expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(UNIFIED_BACKGROUND_TASK);
    });

    it('does not unregister when task is not registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await unregisterUnifiedBackgroundTask();

      expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    });

    it('handles unregistration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
      (BackgroundTask.unregisterTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Unregistration failed'),
      );

      await expect(unregisterUnifiedBackgroundTask()).resolves.not.toThrow();
    });
  });

  describe('task definition', () => {
    it('defines the task with TaskManager on module load', () => {
      expect(taskCallback).toBeDefined();
    });

    it('calls initDatabase on every tick to ensure DB is initialised in the background runtime', async () => {
      (Database.getSetting as jest.Mock).mockReturnValue('0');

      await taskCallback();

      expect(Database.initDatabase).toHaveBeenCalledTimes(1);
    });

    it('runs all three reminder operations when reminders are enabled', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '0';
        return '';
      });
      (NotificationManager.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
      (NotificationManager.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);
      (NotificationManager.processReminderQueue as jest.Mock).mockResolvedValue(undefined);

      const result = await taskCallback();

      expect(NotificationManager.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
      expect(NotificationManager.scheduleDayReminders).toHaveBeenCalledTimes(1);
      expect(NotificationManager.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
      expect(NotificationManager.processReminderQueue).toHaveBeenCalledTimes(1);
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('skips reminder operations when reminders are disabled (count = 0)', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await taskCallback();

      expect(NotificationManager.logReminderQueueSnapshot).not.toHaveBeenCalled();
      expect(NotificationManager.scheduleDayReminders).not.toHaveBeenCalled();
      expect(NotificationManager.maybeScheduleCatchUpReminder).not.toHaveBeenCalled();
      expect(NotificationManager.processReminderQueue).not.toHaveBeenCalled();
    });

    it('fetches weather when weather is enabled', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      const result = await taskCallback();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
        allowPermissionPrompt: false,
      });
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('skips weather fetch when weather is disabled', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await taskCallback();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
    });

    it('continues to weather fetch even if reminder operations throw', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (NotificationManager.scheduleDayReminders as jest.Mock).mockRejectedValue(
        new Error('reminder error'),
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      const result = await taskCallback();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalled();
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Success even if weather fetch throws', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('network error'),
      );

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Failed on a fatal unhandled error', async () => {
      (Database.getSetting as jest.Mock).mockImplementation(() => {
        throw new Error('DB exploded');
      });

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    });
  });
});
