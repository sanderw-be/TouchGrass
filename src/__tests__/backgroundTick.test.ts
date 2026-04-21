/**
 * Tests for performBackgroundTick() — the shared background work unit
 * used by both the Pulsar headless task and the WorkManager fallback.
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
  initDatabaseAsync: jest.fn(),
  insertBackgroundLogAsync: jest.fn(),
}));

import { getContainer, createContainer } from '../core/container';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage';
import { BackgroundService } from '../background/unifiedBackgroundTask';

describe('performBackgroundTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const container = createContainer({} as any);
    // Link container storageService to Database mocks
    container.storageService.getSettingAsync = Database.getSettingAsync as any;
    container.storageService.insertBackgroundLogAsync = Database.insertBackgroundLogAsync as any;

    // Replace container services with local mocks
    (container as any).reminderQueueManager = mockReminderQueueManager;
    (container as any).smartReminderScheduler = mockSmartReminderScheduler;
  });

  it('calls initDatabaseAsync on every tick', async () => {
    const container = getContainer();
    (container.storageService.getSettingAsync as jest.Mock).mockResolvedValue('0');
    (Database.initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);

    await BackgroundService.performBackgroundTick();

    expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('runs all four reminder operations when reminders are enabled', async () => {
    const container = getContainer();
    (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key === 'smart_reminders_count') return '3';
        if (key === 'weather_enabled') return '0';
        return '';
      }
    );
    (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (mockSmartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (mockSmartReminderScheduler.updateUpcomingReminderContent as jest.Mock).mockResolvedValue(
      undefined
    );
    (mockSmartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
      undefined
    );

    await BackgroundService.performBackgroundTick();

    expect(mockReminderQueueManager.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSmartReminderScheduler.scheduleDayReminders).toHaveBeenCalledTimes(1);
    expect(mockSmartReminderScheduler.processReminderQueue).toHaveBeenCalledTimes(1);
    expect(mockSmartReminderScheduler.updateUpcomingReminderContent).toHaveBeenCalledTimes(1);
    expect(mockSmartReminderScheduler.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
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

    await BackgroundService.performBackgroundTick();

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

    await BackgroundService.performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
      allowPermissionPrompt: false,
    });
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

    await BackgroundService.performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
  });

  it('fetches weather before reminder operations (cache warm-up)', async () => {
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
    });
    (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockImplementation(async () => {
      callOrder.push('reminders');
    });
    (mockSmartReminderScheduler.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (mockSmartReminderScheduler.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(
      undefined
    );

    await BackgroundService.performBackgroundTick();

    expect(callOrder[0]).toBe('weather');
    expect(callOrder[1]).toBe('reminders');
  });

  it('logs start/end and skip reasons when weather and reminders are disabled', async () => {
    const container = getContainer();
    (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      }
    );

    await BackgroundService.performBackgroundTick();

    const messages = (
      container.storageService.insertBackgroundLogAsync as jest.Mock
    ).mock.calls.map(([, msg]: [string, string]) => msg);
    expect(messages).toEqual([
      'Background tick start',
      'Weather disabled — skipping refresh',
      'Reminders disabled — skipping background tick work',
      'Background tick done',
    ]);
  });

  it('continues reminder operations even if weather fetch throws', async () => {
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

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();

    expect(mockSmartReminderScheduler.scheduleDayReminders).toHaveBeenCalled();
  });

  it('logs weather failure without stopping the tick', async () => {
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

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();

    const messages = (
      container.storageService.insertBackgroundLogAsync as jest.Mock
    ).mock.calls.map(([, msg]: [string, string]) => msg);
    expect(messages).toContain('Weather refresh failed');
    expect(messages).toContain('Background tick done');
  });

  it('continues when reminder operations throw', async () => {
    const container = getContainer();
    (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'weather_enabled') return '0';
        return '';
      }
    );
    (mockSmartReminderScheduler.scheduleDayReminders as jest.Mock).mockRejectedValue(
      new Error('reminder error')
    );

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();
  });

  it('throws when a fatal error occurs (e.g. DB unavailable)', async () => {
    const container = getContainer();
    (container.storageService.getSettingAsync as jest.Mock).mockImplementation(async () => {
      throw new Error('DB exploded');
    });

    await expect(BackgroundService.performBackgroundTick()).rejects.toThrow(
      'All background sync modules failed'
    );
  });

  describe('concurrency guard', () => {
    it('skips the second concurrent tick and logs a warning', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '1';
          return '';
        }
      );
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      const firstTick = BackgroundService.performBackgroundTick();
      const secondTick = BackgroundService.performBackgroundTick();

      await Promise.all([firstTick, secondTick]);

      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
      const skipCalls = (
        container.storageService.insertBackgroundLogAsync as jest.Mock
      ).mock.calls.filter(
        ([, msg]: [string, string]) => msg === 'Background tick skipped — already running'
      );
      expect(skipCalls).toHaveLength(1);
    });

    it('allows a new tick after the previous one completes', async () => {
      const container = getContainer();
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'smart_reminders_count') return '0';
          if (key === 'weather_enabled') return '0';
          return '';
        }
      );

      await BackgroundService.performBackgroundTick();
      await BackgroundService.performBackgroundTick();

      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(2);
    });

    it('releases the guard even when the tick throws', async () => {
      const container = getContainer();
      let callCount = 0;
      (container.storageService.getSettingAsync as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('DB exploded');
        }
        return '0';
      });

      await expect(BackgroundService.performBackgroundTick()).rejects.toThrow(
        'All background sync modules failed'
      );

      await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();
      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(2);
    });
  });
});
