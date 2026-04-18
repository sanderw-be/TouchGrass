/**
 * Tests for performBackgroundTick() — the shared background work unit
 * used by both the Pulsar headless task and the WorkManager fallback.
 */

jest.mock('../notifications/notificationManager', () => ({
  NotificationService: {
    scheduleDayReminders: jest.fn(),
    maybeScheduleCatchUpReminder: jest.fn(),
    processReminderQueue: jest.fn(),
    logReminderQueueSnapshot: jest.fn(),
    updateUpcomingReminderContent: jest.fn(),
  },
}));

jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(),
}));

jest.mock('../storage/database', () => ({
  getSettingAsync: jest.fn(),
  initDatabaseAsync: jest.fn(),
  insertBackgroundLogAsync: jest.fn(),
}));

import { NotificationService } from '../notifications/notificationManager';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage/database';
import { BackgroundService } from '../background/unifiedBackgroundTask';

describe('performBackgroundTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls initDatabaseAsync on every tick', async () => {
    (Database.getSettingAsync as jest.Mock).mockResolvedValue('0');
    (Database.initDatabaseAsync as jest.Mock).mockResolvedValue(undefined);

    await BackgroundService.performBackgroundTick();

    expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('runs all four reminder operations when reminders are enabled', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '3';
      if (key === 'weather_enabled') return '0';
      return '';
    });
    (NotificationService.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.updateUpcomingReminderContent as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await BackgroundService.performBackgroundTick();

    expect(NotificationService.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
    expect(NotificationService.scheduleDayReminders).toHaveBeenCalledTimes(1);
    expect(NotificationService.processReminderQueue).toHaveBeenCalledTimes(1);
    expect(NotificationService.updateUpcomingReminderContent).toHaveBeenCalledTimes(1);
    expect(NotificationService.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
  });

  it('skips reminder operations when reminders are disabled (count = 0)', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await BackgroundService.performBackgroundTick();

    expect(NotificationService.logReminderQueueSnapshot).not.toHaveBeenCalled();
    expect(NotificationService.scheduleDayReminders).not.toHaveBeenCalled();
    expect(NotificationService.processReminderQueue).not.toHaveBeenCalled();
    expect(NotificationService.updateUpcomingReminderContent).not.toHaveBeenCalled();
    expect(NotificationService.maybeScheduleCatchUpReminder).not.toHaveBeenCalled();
  });

  it('fetches weather when weather is enabled', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

    await BackgroundService.performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
      allowPermissionPrompt: false,
    });
  });

  it('skips weather fetch when weather is disabled', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await BackgroundService.performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
  });

  it('fetches weather before reminder operations (cache warm-up)', async () => {
    const callOrder: string[] = [];
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockImplementation(async () => {
      callOrder.push('weather');
    });
    (NotificationService.scheduleDayReminders as jest.Mock).mockImplementation(async () => {
      callOrder.push('reminders');
    });
    (NotificationService.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await BackgroundService.performBackgroundTick();

    expect(callOrder[0]).toBe('weather');
    expect(callOrder[1]).toBe('reminders');
  });

  it('logs start/end and skip reasons when weather and reminders are disabled', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await BackgroundService.performBackgroundTick();

    const messages = (Database.insertBackgroundLogAsync as jest.Mock).mock.calls.map(
      ([, msg]: [string, string]) => msg
    );
    expect(messages).toEqual([
      'Background tick start',
      'Weather disabled — skipping refresh',
      'Reminders disabled — skipping background tick work',
      'Background tick done',
    ]);
  });

  it('continues reminder operations even if weather fetch throws', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
      new Error('network error')
    );
    (NotificationService.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();

    expect(NotificationService.scheduleDayReminders).toHaveBeenCalled();
  });

  it('logs weather failure without stopping the tick', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
      new Error('network error')
    );

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();

    const messages = (Database.insertBackgroundLogAsync as jest.Mock).mock.calls.map(
      ([, msg]: [string, string]) => msg
    );
    expect(messages).toContain('Weather refresh failed');
    expect(messages).toContain('Background tick done');
  });

  it('continues when reminder operations throw', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '0';
      return '';
    });
    (NotificationService.scheduleDayReminders as jest.Mock).mockRejectedValue(
      new Error('reminder error')
    );

    await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();
  });

  it('throws when a fatal error occurs (e.g. DB unavailable)', async () => {
    (Database.getSettingAsync as jest.Mock).mockImplementation(async () => {
      throw new Error('DB exploded');
    });

    await expect(BackgroundService.performBackgroundTick()).rejects.toThrow('DB exploded');
  });

  describe('concurrency guard', () => {
    it('skips the second concurrent tick and logs a warning', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        // Enable weather so the first tick hits `await fetchWeatherForecast` and
        // yields control before completing — this is the yield point that makes
        // the tickInProgress flag visible to the second call.
        if (key === 'weather_enabled') return '1';
        return '';
      });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      // Start the first tick without awaiting — it runs synchronously until the
      // first `await` (fetchWeatherForecast) and sets tickInProgress = true.
      const firstTick = BackgroundService.performBackgroundTick();
      // The second tick starts before the first has finished: the flag is set.
      const secondTick = BackgroundService.performBackgroundTick();

      await Promise.all([firstTick, secondTick]);

      // initDatabase should only have been called once (from the first tick).
      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(1);
      // The skip log must appear exactly once.
      const skipCalls = (Database.insertBackgroundLogAsync as jest.Mock).mock.calls.filter(
        ([, msg]: [string, string]) => msg === 'Background tick skipped — already running'
      );
      expect(skipCalls).toHaveLength(1);
    });

    it('allows a new tick after the previous one completes', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await BackgroundService.performBackgroundTick();
      await BackgroundService.performBackgroundTick();

      // Both ticks ran to completion — initDatabase called twice.
      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(2);
    });

    it('releases the guard even when the tick throws', async () => {
      let callCount = 0;
      (Database.getSettingAsync as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('DB exploded');
        return '0';
      });

      // First tick throws — guard must still be cleared via finally.
      await expect(BackgroundService.performBackgroundTick()).rejects.toThrow('DB exploded');

      // Second tick should run normally (not be blocked by a stale flag).
      await expect(BackgroundService.performBackgroundTick()).resolves.not.toThrow();
      expect(Database.initDatabaseAsync).toHaveBeenCalledTimes(2);
    });
  });
});
