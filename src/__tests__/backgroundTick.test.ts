jest.mock('react-native-background-actions', () => ({
  isRunning: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../notifications/notificationManager', () => ({
  scheduleDayReminders: jest.fn(),
  maybeScheduleCatchUpReminder: jest.fn(),
  scheduleNextReminder: jest.fn(),
}));

jest.mock('../storage/database', () => ({
  getSetting: jest.fn(() => '[]'),
}));

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => ({
    scheduleNextPulse: jest.fn(),
  })),
}));

import * as NotificationManager from '../notifications/notificationManager';
import * as Database from '../storage/database';
import { requireNativeModule } from 'expo-modules-core';
import { performBackgroundTick } from '../background/backgroundTick';

describe('performBackgroundTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: today's planning was already done
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'reminders_last_planned_date') return new Date().toDateString();
      return fallback;
    });
    (NotificationManager.scheduleDayReminders as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.maybeScheduleCatchUpReminder as jest.Mock).mockResolvedValue(undefined);
    (NotificationManager.scheduleNextReminder as jest.Mock).mockResolvedValue(undefined);
  });

  it('runs maybeScheduleCatchUpReminder and scheduleNextReminder on every tick', async () => {
    await performBackgroundTick();

    expect(NotificationManager.maybeScheduleCatchUpReminder).toHaveBeenCalledTimes(1);
    expect(NotificationManager.scheduleNextReminder).toHaveBeenCalledTimes(1);
  });

  it('skips scheduleDayReminders when already planned today', async () => {
    await performBackgroundTick();

    expect(NotificationManager.scheduleDayReminders).not.toHaveBeenCalled();
  });

  it('calls scheduleDayReminders when planning has not been done today', async () => {
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'reminders_last_planned_date') return 'some-other-date';
      return fallback;
    });

    await performBackgroundTick();

    expect(NotificationManager.scheduleDayReminders).toHaveBeenCalledTimes(1);
  });

  it('schedules the next alarm pulse via AlarmBridgeNative', async () => {
    const mockScheduleNextPulse = jest.fn();
    (requireNativeModule as jest.Mock).mockReturnValue({
      scheduleNextPulse: mockScheduleNextPulse,
    });

    await performBackgroundTick();

    expect(requireNativeModule).toHaveBeenCalledWith('AlarmBridgeNative');
    expect(mockScheduleNextPulse).toHaveBeenCalledTimes(1);
    // The scheduled timestamp should be in the future
    expect(mockScheduleNextPulse.mock.calls[0][0]).toBeGreaterThan(Date.now());
  });

  it('still completes when AlarmBridgeNative throws', async () => {
    (requireNativeModule as jest.Mock).mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    await expect(performBackgroundTick()).resolves.toBeUndefined();
  });

  it('still completes when a notification function throws', async () => {
    (NotificationManager.scheduleNextReminder as jest.Mock).mockRejectedValue(
      new Error('notification error'),
    );

    await expect(performBackgroundTick()).resolves.toBeUndefined();
    // Pulse scheduling still runs (finally block)
    expect(requireNativeModule).toHaveBeenCalledWith('AlarmBridgeNative');
  });
});
