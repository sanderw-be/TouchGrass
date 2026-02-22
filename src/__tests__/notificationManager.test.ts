jest.mock('expo-notifications');
jest.mock('../storage/database');
jest.mock('../notifications/reminderAlgorithm');
jest.mock('../notifications/scheduledNotifications');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');
jest.mock('../i18n', () => ({ t: (key: string) => key }));

import * as Notifications from 'expo-notifications';
import * as Database from '../storage/database';
import * as ReminderAlgorithm from '../notifications/reminderAlgorithm';
import * as ScheduledNotifications from '../notifications/scheduledNotifications';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import {
  scheduleNextReminder,
  scheduleDayReminders,
} from '../notifications/notificationManager';

describe('notificationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
    (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
    (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => fallback);
    (Database.setSetting as jest.Mock).mockReturnValue(undefined);
    (ScheduledNotifications.hasScheduledNotificationNearby as jest.Mock).mockReturnValue(false);
    (WeatherService.isWeatherDataAvailable as jest.Mock).mockReturnValue(false);
    (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');
  });

  describe('scheduleNextReminder', () => {
    it('does not send a reminder and cancels existing automatic reminders when daily goal is reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        if (key === 'currently_outside') return '0';
        return fallback;
      });
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockReturnValue({
        should: false,
        reason: 'daily goal reached',
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
      ]);

      await scheduleNextReminder();

      // Should not schedule a new reminder
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Should cancel the automatic reminder (not the scheduled one)
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto_reminder_1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('scheduled_1_2');
    });

    it('does not cancel reminders for other non-goal-reached reasons', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        if (key === 'currently_outside') return '1';
        return fallback;
      });
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockReturnValue({
        should: false,
        reason: 'currently outside',
      });

      await scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('sends a reminder when goal is not reached and conditions are met', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        if (key === 'currently_outside') return '0';
        if (key === 'last_reminder_ms') return '0';
        return fallback;
      });
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockReturnValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    it('does nothing when reminders are disabled', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '0';
        return fallback;
      });

      await scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('scheduleDayReminders', () => {
    it('does not schedule any reminders and cancels existing ones when daily goal is already reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        return fallback;
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_morning_reminder' },
        { identifier: 'scheduled_1_3' },
      ]);

      await scheduleDayReminders();

      // Should not schedule any new reminders
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Should cancel existing automatic reminders
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto_morning_reminder');
      // Should preserve scheduled (user-configured) notifications
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('scheduled_1_3');
    });

    it('does not schedule when goal minutes exceeded', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(45);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when reminders are disabled', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '0';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules reminders when goal is not yet reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_enabled') return '1';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, score: 0.8, reason: 'lunch' },
        { hour: 17, score: 0.7, reason: 'after-work' },
        { hour: 8, score: 0.3, reason: 'past' },
      ]);

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });
});
