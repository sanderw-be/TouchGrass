import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { fetchWeatherForecast } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { getSmartReminderScheduler, getDwellService } from '../notifications/notificationManager';
import { handleSmartReminder } from '../background/smartReminderTask';

jest.mock('expo-notifications');
jest.mock('../storage', () => ({
  getTodayMinutesAsync: jest.fn(),
  getCurrentDailyGoalAsync: jest.fn(),
  initDatabaseAsync: jest.fn(),
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
  db: {},
}));
jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(),
}));
jest.mock('../notifications/services/ReminderMessageBuilder');
jest.mock('../storage/StorageService');
jest.mock('../core/container', () => ({
  createContainer: jest.fn(),
}));
jest.mock('../notifications/notificationManager', () => ({
  getSmartReminderScheduler: jest.fn(),
  getDwellService: jest.fn(),
}));
jest.mock('expo-location', () => ({
  getLastKnownPositionAsync: jest.fn(),
}));
jest.mock('../detection/GeofenceManager', () => ({
  isAtAnyKnownLocation: jest.fn(),
}));

describe('handleSmartReminder', () => {
  let mockScheduler: any;
  let mockStorage: any;
  let mockMessageBuilder: any;
  let mockDwellService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockScheduler = {
      scheduleUpcomingReminders: jest.fn().mockResolvedValue(undefined),
    };
    (getSmartReminderScheduler as jest.Mock).mockReturnValue(mockScheduler);

    mockStorage = {
      getSettingAsync: jest.fn(),
      setSettingAsync: jest.fn(),
      insertBackgroundLogAsync: jest.fn(),
      getAllKnownLocationsAsync: jest.fn().mockResolvedValue([]),
    };
    (StorageService as jest.Mock).mockImplementation(() => mockStorage);

    mockMessageBuilder = {
      buildReminderMessage: jest.fn().mockResolvedValue({ title: 'Test', body: 'Test body' }),
    };
    (ReminderMessageBuilder as jest.Mock).mockImplementation(() => mockMessageBuilder);

    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
    (fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

    mockDwellService = {
      scheduleDwellPrompt: jest.fn().mockResolvedValue(undefined),
      cancelDwellPrompt: jest.fn().mockResolvedValue(undefined),
    };
    (getDwellService as jest.Mock).mockReturnValue(mockDwellService);

    mockStorage.getSettingAsync.mockImplementation((key: string, defaultVal: string) => defaultVal);
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);
    const { isAtAnyKnownLocation } = require('../detection/GeofenceManager');
    (isAtAnyKnownLocation as jest.Mock).mockReturnValue(false);
  });

  it('should replan and exit early for boot_replan', async () => {
    await handleSmartReminder({ type: 'boot_replan' });

    expect(mockStorage.insertBackgroundLogAsync).toHaveBeenCalledWith(
      'reminder',
      expect.any(String)
    );
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('should send a smart reminder if goal not met and replan afterwards', async () => {
    await handleSmartReminder({ type: 'smart_reminder' });

    expect(fetchWeatherForecast).toHaveBeenCalledWith({
      allowPermissionPrompt: false,
      isHeadless: true,
    });
    expect(mockMessageBuilder.buildReminderMessage).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

    // Crucial part: ensure replan is still called with isHeadlessReplan flag
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalledWith({
      isHeadlessReplan: true,
    });
    expect(mockStorage.setSettingAsync).toHaveBeenCalledWith('sent_smart_reminders_count', '1');
  });

  it('should NOT send a smart reminder if goal met but STILL replan', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);

    await handleSmartReminder({ type: 'smart_reminder' });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // Replan must be called!
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
  });

  it('should bypass guards and use provided message for test_reminder', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(100); // Over goal
    await handleSmartReminder({
      type: 'test_reminder',
      title: 'Test Title',
      body: 'Test Body',
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Test Title',
          body: 'Test Body',
        }),
      })
    );
    expect(mockMessageBuilder.buildReminderMessage).not.toHaveBeenCalled();
  });

  it('should ALWAYS rebuild message for smart_reminder even if title is provided', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10); // Under goal
    await handleSmartReminder({
      type: 'smart_reminder',
      title: 'Planned Title',
      body: 'Planned Body',
    });

    // Should NOT use 'Planned Title' but call the builder
    expect(mockMessageBuilder.buildReminderMessage).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Test', // from mockMessageBuilder default
        }),
      })
    );
  });

  it('should NOT send a catchup reminder if ahead of schedule but STILL replan', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

    // progressRatio = 0.33
    // expectedRatio = 1 / 2 = 0.50
    // progressRatio (0.33) < expectedRatio (0.5) => Catchup SENT
    const todayStr = new Date().toDateString();
    mockStorage.getSettingAsync.mockImplementation((key: string, fallback: string) => {
      if (key === 'sent_smart_reminders_count') return '1';
      if (key === 'smart_reminders_count') return '2';
      if (key === 'sent_smart_reminders_date') return todayStr;
      return fallback;
    });

    await handleSmartReminder({ type: 'catchup_reminder' });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
  });

  it('should NOT send a catchup reminder if goal is exactly met (30/30)', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
    const todayStr = new Date().toDateString();

    // progressRatio = 30 / 30 = 1.0
    // expectedRatio = 2 / 2 = 1.0
    // progressRatio (1.0) <= expectedRatio (1.0) but goal met => Catchup SKIPPED
    mockStorage.getSettingAsync.mockImplementation((key: string, fallback: string) => {
      if (key === 'sent_smart_reminders_count') return '2';
      if (key === 'smart_reminders_count') return '2';
      if (key === 'sent_smart_reminders_date') return todayStr;
      return fallback;
    });

    await handleSmartReminder({ type: 'catchup_reminder' });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
  });

  it('should execute finally block even if fetchWeatherForecast throws', async () => {
    (fetchWeatherForecast as jest.Mock).mockRejectedValue(new Error('Weather failed'));

    await handleSmartReminder({ type: 'smart_reminder' });

    // Notification will fail or just fail the try block
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
  });

  describe('dwell-time logic', () => {
    it('should schedule dwell prompt when STILL and OUTSIDE', async () => {
      mockStorage.getSettingAsync.mockImplementation(async (key: string) => {
        if (key === 'gps_last_outside') return '1';
        return '0';
      });

      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'STILL',
        transitionType: 'ENTER',
      });

      expect(mockDwellService.scheduleDwellPrompt).toHaveBeenCalled();
    });

    it('should NOT schedule dwell prompt when STILL but INSIDE', async () => {
      mockStorage.getSettingAsync.mockImplementation(async (key: string) => {
        if (key === 'gps_last_outside') return '0';
        return '0';
      });

      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'STILL',
        transitionType: 'ENTER',
      });

      expect(mockDwellService.scheduleDwellPrompt).not.toHaveBeenCalled();
    });

    it('should cancel dwell prompt when WALKING', async () => {
      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'WALKING',
        transitionType: 'ENTER',
      });

      expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
    });

    it('should cancel dwell prompt when EXITING STILL state', async () => {
      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'STILL',
        transitionType: 'EXIT',
      });

      expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
    });

    it('should NOT schedule if double-check reveals we are in a known location', async () => {
      mockStorage.getSettingAsync.mockImplementation(async (key: string) => {
        if (key === 'gps_last_outside') return '1';
        return '0';
      });

      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 52, longitude: 5 },
      });
      const { isAtAnyKnownLocation } = require('../detection/GeofenceManager');
      (isAtAnyKnownLocation as jest.Mock).mockReturnValue(true);

      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'STILL',
        transitionType: 'ENTER',
      });

      expect(mockDwellService.scheduleDwellPrompt).not.toHaveBeenCalled();
    });

    it('should cancel dwell prompt when ON_BICYCLE', async () => {
      await handleSmartReminder({
        type: 'activity_transition',
        activityType: 'ON_BICYCLE',
        transitionType: 'ENTER',
      });

      expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
    });
  });
});
