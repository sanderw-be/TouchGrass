/**
 * Tests for performBackgroundTick() — the shared background work unit
 * used by both the Pulsar headless task and the WorkManager fallback.
 */

jest.mock('../notifications/notificationManager', () => ({
  scheduleDayReminders: jest.fn(),
  maybeScheduleCatchUpReminder: jest.fn(),
  processReminderQueue: jest.fn(),
  logReminderQueueSnapshot: jest.fn(),
  updateUpcomingReminderContent: jest.fn(),
}));

jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(),
}));

jest.mock('../storage/database', () => ({
  getSetting: jest.fn(),
  initDatabase: jest.fn(),
  insertBackgroundLog: jest.fn(),
}));

import * as NotificationManager from '../notifications/notificationManager';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage/database';
import { performBackgroundTick } from '../background/backgroundTick';

describe('performBackgroundTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls initDatabase on every tick', async () => {
    (Database.getSetting as jest.Mock).mockReturnValue('0');

    await performBackgroundTick();

    expect(Database.initDatabase).toHaveBeenCalledTimes(1);
  });

  it('runs all four reminder operations when reminders are enabled', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '3';
      if (key === 'weather_enabled') return '0';
      return '';
    });
    (NotificationManager.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.updateUpcomingReminderContent as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await performBackgroundTick();

    expect(NotificationManager.logReminderQueueSnapshot).toHaveBeenCalledTimes(1);
    expect(NotificationManager.scheduleDayReminders).toHaveBeenCalledTimes(1);
    expect(NotificationManager.processReminderQueue).toHaveBeenCalledTimes(1);
    expect(NotificationManager.updateUpcomingReminderContent).toHaveBeenCalledTimes(1);
    expect(NotificationManager.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
  });

  it('skips reminder operations when reminders are disabled (count = 0)', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await performBackgroundTick();

    expect(NotificationManager.logReminderQueueSnapshot).not.toHaveBeenCalled();
    expect(NotificationManager.scheduleDayReminders).not.toHaveBeenCalled();
    expect(NotificationManager.processReminderQueue).not.toHaveBeenCalled();
    expect(NotificationManager.updateUpcomingReminderContent).not.toHaveBeenCalled();
    expect(NotificationManager.maybeScheduleCatchUpReminder).not.toHaveBeenCalled();
  });

  it('fetches weather when weather is enabled', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

    await performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
      allowPermissionPrompt: false,
    });
  });

  it('skips weather fetch when weather is disabled', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await performBackgroundTick();

    expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
  });

  it('fetches weather before reminder operations (cache warm-up)', async () => {
    const callOrder: string[] = [];
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockImplementation(async () => {
      callOrder.push('weather');
    });
    (NotificationManager.scheduleDayReminders as jest.Mock).mockImplementation(async () => {
      callOrder.push('reminders');
    });
    (NotificationManager.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await performBackgroundTick();

    expect(callOrder[0]).toBe('weather');
    expect(callOrder[1]).toBe('reminders');
  });

  it('logs start/end and skip reasons when weather and reminders are disabled', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '0';
      return '';
    });

    await performBackgroundTick();

    const messages = (Database.insertBackgroundLog as jest.Mock).mock.calls.map(
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
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
      new Error('network error')
    );
    (NotificationManager.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.processReminderQueue as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);

    await expect(performBackgroundTick()).resolves.not.toThrow();

    expect(NotificationManager.scheduleDayReminders).toHaveBeenCalled();
  });

  it('logs weather failure without stopping the tick', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '0';
      if (key === 'weather_enabled') return '1';
      return '';
    });
    (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
      new Error('network error')
    );

    await expect(performBackgroundTick()).resolves.not.toThrow();

    const messages = (Database.insertBackgroundLog as jest.Mock).mock.calls.map(
      ([, msg]: [string, string]) => msg
    );
    expect(messages).toContain('Weather refresh failed');
    expect(messages).toContain('Background tick done');
  });

  it('continues when reminder operations throw', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'smart_reminders_count') return '2';
      if (key === 'weather_enabled') return '0';
      return '';
    });
    (NotificationManager.scheduleDayReminders as jest.Mock).mockRejectedValue(
      new Error('reminder error')
    );

    await expect(performBackgroundTick()).resolves.not.toThrow();
  });

  it('throws when a fatal error occurs (e.g. DB unavailable)', async () => {
    (Database.getSetting as jest.Mock).mockImplementation(() => {
      throw new Error('DB exploded');
    });

    await expect(performBackgroundTick()).rejects.toThrow('DB exploded');
  });

  describe('concurrency guard', () => {
    it('skips the second concurrent tick and logs a warning', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
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
      const firstTick = performBackgroundTick();
      // The second tick starts before the first has finished: the flag is set.
      const secondTick = performBackgroundTick();

      await Promise.all([firstTick, secondTick]);

      // initDatabase should only have been called once (from the first tick).
      expect(Database.initDatabase).toHaveBeenCalledTimes(1);
      // The skip log must appear exactly once.
      const skipCalls = (Database.insertBackgroundLog as jest.Mock).mock.calls.filter(
        ([, msg]: [string, string]) => msg === 'Background tick skipped — already running'
      );
      expect(skipCalls).toHaveLength(1);
    });

    it('allows a new tick after the previous one completes', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'smart_reminders_count') return '0';
        if (key === 'weather_enabled') return '0';
        return '';
      });

      await performBackgroundTick();
      await performBackgroundTick();

      // Both ticks ran to completion — initDatabase called twice.
      expect(Database.initDatabase).toHaveBeenCalledTimes(2);
    });

    it('releases the guard even when the tick throws', async () => {
      let callCount = 0;
      (Database.getSetting as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('DB exploded');
        return '0';
      });

      // First tick throws — guard must still be cleared via finally.
      await expect(performBackgroundTick()).rejects.toThrow('DB exploded');

      // Second tick should run normally (not be blocked by a stale flag).
      await expect(performBackgroundTick()).resolves.not.toThrow();
      expect(Database.initDatabase).toHaveBeenCalledTimes(2);
    });
  });
});
