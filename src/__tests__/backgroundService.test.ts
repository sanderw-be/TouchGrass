/**
 * Tests for the unified background task (WorkManager fallback).
 * The primary background execution path is now the Pulsar chained-alarm
 * (TOUCHGRASS_PULSE_TASK), but the unified task remains as a fallback and
 * delegates to the shared performBackgroundTick() helper.
 */

const mockReminderQueueManager = {
  logReminderQueueSnapshot: jest.fn(),
};
const mockSmartReminderScheduler = {
  scheduleDayReminders: jest.fn(),
  maybeScheduleCatchUpReminder: jest.fn(),
  processReminderQueue: jest.fn(),
  updateUpcomingReminderContent: jest.fn(),
};

jest.mock('../notifications/notificationManager', () => ({
  getReminderQueueManager: () => mockReminderQueueManager,
  getSmartReminderScheduler: () => mockSmartReminderScheduler,
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
import { getContainer, createContainer } from '../core/container';
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
    const container = createContainer({} as any);
    // Link container storageService to Database mocks
    container.storageService.getSettingAsync = Database.getSettingAsync as any;
    container.storageService.insertBackgroundLogAsync = Database.insertBackgroundLogAsync as any;

    // Replace container services with local mocks for easy spying
    (container as any).reminderQueueManager = mockReminderQueueManager;
    (container as any).smartReminderScheduler = mockSmartReminderScheduler;
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
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockResolvedValue('0');

      await taskCallback();

      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
    });

    it('runs all four reminder operations when reminders are enabled', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'weather_enabled') return '0';
          return '';
        }
      );
      (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
      (mockSmartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );
      (mockSmartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (mockSmartReminderScheduler.updateUpcomingReminderContent as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await taskCallback();

      expect(mockReminderQueueManager.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
      expect(mockSmartReminderScheduler.scheduleDayReminders).toHaveBeenCalledTimes(1);
      expect(mockSmartReminderScheduler.processReminderQueue).toHaveBeenCalledTimes(1);
      expect(mockSmartReminderScheduler.updateUpcomingReminderContent).toHaveBeenCalledTimes(1);
      expect(mockSmartReminderScheduler.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('skips reminder operations when reminders are disabled (count = 0)', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '0';
          return '';
        }
      );

      await taskCallback();

      expect(mockReminderQueueManager.logReminderQueueSnapshot).not.toHaveBeenCalled();
      expect(mockSmartReminderScheduler.scheduleDayReminders).not.toHaveBeenCalled();
      expect(mockSmartReminderScheduler.processReminderQueue).not.toHaveBeenCalled();
      expect(mockSmartReminderScheduler.updateUpcomingReminderContent).not.toHaveBeenCalled();
      expect(mockSmartReminderScheduler.maybeScheduleCatchUpReminder).not.toHaveBeenCalled();
    });

    it('fetches weather when weather is enabled', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '1';
          return '';
        }
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      const result = await taskCallback();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
        allowPermissionPrompt: false,
      });
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('skips weather fetch when weather is disabled', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '0';
          return '';
        }
      );

      await taskCallback();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
    });

    it('fetches weather before reminder operations (weather warms cache for reminder scoring)', async () => {
      const callOrder: string[] = [];
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'weather_enabled') return '1';
          return '';
        }
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockImplementation(async () => {
        callOrder.push('weather');
        return { success: true };
      });
      (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockImplementation(
        async () => {
          callOrder.push('reminders');
        }
      );
      (mockSmartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (mockSmartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );

      await taskCallback();

      expect(callOrder[0]).toBe('weather');
      expect(callOrder[1]).toBe('reminders');
    });

    it('continues to run reminder operations even if weather fetch throws', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'weather_enabled') return '1';
          return '';
        }
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('network error')
      );
      (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
      (mockSmartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
      (mockSmartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await taskCallback();

      expect(mockSmartReminderScheduler.scheduleDayReminders).toHaveBeenCalled();
      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Success even if weather fetch throws', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '1';
          return '';
        }
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('network error')
      );

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('returns Failed on a fatal unhandled error', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(async () => {
        throw new Error('DB exploded');
      });

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    });

    it('re-arms the Pulsar alarm chain on every successful tick', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockResolvedValue('0');
      const scheduleSpy = jest
        .spyOn(BackgroundService, 'scheduleNextAlarmPulse')
        .mockResolvedValue(undefined);

      await taskCallback();

      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-arm the alarm chain when a fatal error occurs', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(async () => {
        throw new Error('DB exploded');
      });
      const scheduleSpy = jest.spyOn(BackgroundService, 'scheduleNextAlarmPulse');

      await taskCallback();

      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });
});
