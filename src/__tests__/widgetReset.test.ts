import * as Notifications from 'expo-notifications';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { StorageService } from '../storage/StorageService';
import { getSmartReminderScheduler } from '../notifications/notificationManager';
import { handleSmartReminder } from '../background/smartReminderTask';
import { requestWidgetRefresh } from '../utils/widgetHelper';

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
jest.mock('../utils/widgetHelper', () => ({
  requestWidgetRefresh: jest.fn().mockResolvedValue(undefined),
  WIDGET_TIMER_KEY: 'widget_timer_start',
  isWidgetTimerRunning: jest.fn(),
}));

describe('handleSmartReminder - Widget Reset', () => {
  let mockScheduler: any;
  let mockStorage: any;

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

    (getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

    mockStorage.getSettingAsync.mockImplementation((key: string, defaultVal: string) => defaultVal);
  });

  it('should refresh widget and exit early for widget_reset', async () => {
    await handleSmartReminder({ type: 'widget_reset' });

    expect(mockStorage.insertBackgroundLogAsync).toHaveBeenCalledWith(
      'widget',
      expect.stringContaining('Midnight widget reset')
    );
    expect(requestWidgetRefresh).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    // Should still trigger replan in finally block
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalledWith({
      isHeadlessReplan: true,
    });
  });

  it('should handle errors during widget refresh gracefully', async () => {
    const error = new Error('Widget refresh failed');
    (requestWidgetRefresh as jest.Mock).mockRejectedValueOnce(error);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await handleSmartReminder({ type: 'widget_reset' });

    expect(requestWidgetRefresh).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[SR_HEADLESS] Failed to refresh widget:', error);
    expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
