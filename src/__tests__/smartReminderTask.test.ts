import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { fetchWeatherForecast } from '../weather/weatherService';
import { ReminderMessageBuilder } from '../notifications/services/ReminderMessageBuilder';
import { StorageService } from '../storage/StorageService';
import { getSmartReminderScheduler } from '../notifications/notificationManager';
import { handleSmartReminder } from '../background/smartReminderTask';

jest.mock('expo-notifications');
jest.mock('../storage', () => ({
  getTodayMinutesAsync: jest.fn(),
  getCurrentDailyGoalAsync: jest.fn(),
  initDatabaseAsync: jest.fn(),
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
}));

describe('handleSmartReminder', () => {
  let mockScheduler: any;
  let mockStorage: any;
  let mockMessageBuilder: any;

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
    };
    (StorageService as jest.Mock).mockImplementation(() => mockStorage);

    mockMessageBuilder = {
      buildReminderMessage: jest.fn().mockResolvedValue({ title: 'Test', body: 'Test body' }),
    };
    (ReminderMessageBuilder as jest.Mock).mockImplementation(() => mockMessageBuilder);

    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
    (fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

    mockStorage.getSettingAsync.mockImplementation((key: string, defaultVal: string) => defaultVal);
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

  it('should NOT send a catchup reminder if ahead of schedule but STILL replan', async () => {
    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

    // progressRatio = 0.33
    // expectedRatio = 1 / 2 = 0.50
    // Actually, ahead of schedule means progressRatio > expectedRatio
    mockStorage.getSettingAsync.mockImplementation((key: string, fallback: string) => {
      if (key === 'sent_smart_reminders_count') return '0'; // 0 sent out of 2 => expectedRatio 0
      if (key === 'smart_reminders_count') return '2';
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
});
