/**
 * Tests for the unified background task (WorkManager fallback).
 * The primary background execution path is now the Pulsar chained-alarm
 * (TOUCHGRASS_PULSE_TASK), but the unified task remains as a fallback and
 * delegates to the shared performBackgroundTick() helper.
 */

jest.mock('../notifications/notificationManager', () => ({
  reminderQueueManager: {
    logReminderQueueSnapshot: jest.fn(),
  },
  smartReminderScheduler: {
    scheduleDayReminders: jest.fn(),
    maybeScheduleCatchUpReminder: jest.fn(),
    processReminderQueue: jest.fn(),
    updateUpcomingReminderContent: jest.fn(),
  },
}));

jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(),
}));

jest.mock('../storage', () => ({
  getSettingAsync: jest.fn(),
  initDatabaseAsync: jest.fn(() => Promise.resolve()),
  insertBackgroundLogAsync: jest.fn(),
}));

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { reminderQueueManager, smartReminderScheduler } from '../notifications/notificationManager';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage';
import { UNIFIED_BACKGROUND_TASK, BackgroundService } from '../background/unifiedBackgroundTask';

describe('unifiedBackgroundTask', () => {
  // Capture the task callback registered at module load time
  let taskCallback: (...args: any[]) => Promise<any>;

  beforeAll(() => {
    const call = (TaskManager.defineTask as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === UNIFIED_BACKGROUND_TASK
    );
    taskCallback = call?.[1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUnifiedBackgroundTask', () => {
    it('registers the task when not already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await BackgroundService.registerUnifiedBackgroundTask();

      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(UNIFIED_BACKGROUND_TASK, {
        minimumInterval: 15,
      });
    });

    it('does not register the task when already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await BackgroundService.registerUnifiedBackgroundTask();

      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it('handles registration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
      (BackgroundTask.registerTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Registration failed')
      );

      await expect(BackgroundService.registerUnifiedBackgroundTask()).resolves.not.toThrow();
    });
  });

  describe('unregisterUnifiedBackgroundTask', () => {
    it('unregisters the task when registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await BackgroundService.unregisterUnifiedBackgroundTask();

      expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(UNIFIED_BACKGROUND_TASK);
    });

    it('does not unregister when task is not registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await BackgroundService.unregisterUnifiedBackgroundTask();

      expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    });

    it('handles unregistration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
      (BackgroundTask.unregisterTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Unregistration failed')
      );

      await expect(BackgroundService.unregisterUnifiedBackgroundTask()).resolves.not.toThrow();
    });
  });

  describe('task definition', () => {
    it('defines the task with TaskManager on module load', () => {
      expect(taskCallback).toBeDefined();
    });

    it('calls initDatabaseAsync on every tick to ensure DB is initialised in the background runtime', async () => {
      (Database.getSettingAsync as jest.Mock).mockResolvedValue('0');

      await taskCallback();

      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
    });

    it('runs all four reminder operations when reminders are enabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '0';
        return '';
      });
      (smartReminderScheduler.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
      (smartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );
      (smartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (smartReminderScheduler.updateUpcomingReminderContent as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await taskCallback();

      expect(reminderQueueManager.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
      expect(smartReminderScheduler.scheduleDayReminders).toHaveBeenCalledTimes(1);
      expect(smartReminderScheduler.processReminderQueue).toHaveBeenCalledTimes(1);
      expect(smartReminderScheduler.updateUpcomingReminderContent).toHaveBeenCalledTimes(1);
      expect(smartReminderScheduler.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('skips reminder operations when reminders are disabled (count = 0)', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await taskCallback();

      expect(reminderQueueManager.logReminderQueueSnapshot).not.toHaveBeenCalled();
      expect(smartReminderScheduler.scheduleDayReminders).not.toHaveBeenCalled();
      expect(smartReminderScheduler.processReminderQueue).not.toHaveBeenCalled();
      expect(smartReminderScheduler.updateUpcomingReminderContent).not.toHaveBeenCalled();
      expect(smartReminderScheduler.maybeScheduleCatchUpReminder).not.toHaveBeenCalled();
    });

    it('fetches weather when weather is enabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
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
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await taskCallback();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
    });

    it('fetches weather before reminder operations (weather warms cache for reminder scoring)', async () => {
      const callOrder: string[] = [];
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockImplementation(async () => {
        callOrder.push('weather');
        return { success: true };
      });
      (smartReminderScheduler.scheduleDayReminders as jest.Mock).mockImplementation(async () => {
        callOrder.push('reminders');
      });
      (smartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (smartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );

      await taskCallback();

      expect(callOrder[0]).toBe('weather');
      expect(callOrder[1]).toBe('reminders');
    });

    it('continues to run reminder operations even if weather fetch throws', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('network error')
      );
      (smartReminderScheduler.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
      (smartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (smartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await taskCallback();

      expect(smartReminderScheduler.scheduleDayReminders).toHaveBeenCalled();
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Success even if weather fetch throws', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('network error')
      );

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Failed on a fatal unhandled error', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async () => {
        throw new Error('DB exploded');
      });

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    });

    it('re-arms the Pulsar alarm chain on every successful tick', async () => {
      (Database.getSettingAsync as jest.Mock).mockResolvedValue('0');
      const scheduleSpy = jest
        .spyOn(BackgroundService, 'scheduleNextAlarmPulse')
        .mockResolvedValue(undefined);

      await taskCallback();

      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-arm the alarm chain when a fatal error occurs', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async () => {
        throw new Error('DB exploded');
      });
      const scheduleSpy = jest.spyOn(BackgroundService, 'scheduleNextAlarmPulse');

      await taskCallback();

      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });
});
