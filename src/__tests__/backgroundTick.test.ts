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
});
