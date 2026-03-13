jest.mock('expo-notifications');
jest.mock('../storage/database');
jest.mock('../notifications/reminderAlgorithm');
jest.mock('../notifications/scheduledNotifications');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');
jest.mock('../i18n', () => ({ t: (key: string) => key }));
jest.mock('../calendar/calendarService', () => ({
  hasUpcomingEvent: jest.fn(() => Promise.resolve(false)),
  maybeAddOutdoorTimeToCalendar: jest.fn(() => Promise.resolve()),
}));
jest.mock('../context/ReminderFeedbackContext', () => ({
  triggerReminderFeedbackModal: jest.fn(),
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Database from '../storage/database';
import * as ReminderAlgorithm from '../notifications/reminderAlgorithm';
import * as ScheduledNotifications from '../notifications/scheduledNotifications';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import * as CalendarService from '../calendar/calendarService';
import * as FeedbackContext from '../context/ReminderFeedbackContext';
import {
  scheduleNextReminder,
  scheduleDayReminders,
  maybeScheduleCatchUpReminder,
  setupNotificationInfrastructure,
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
    (ScheduledNotifications.isSlotNearScheduledNotification as jest.Mock).mockReturnValue(false);
    (WeatherService.isWeatherDataAvailable as jest.Mock).mockReturnValue(false);
    (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
    (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('🌡️');
    (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('weather_unknown');
    (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true, conditions: [] });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mockResolvedValue(undefined);
    (CalendarService.hasUpcomingEvent as jest.Mock).mockResolvedValue(false);
  });

  describe('setupNotificationInfrastructure', () => {
    it('creates Android channels including the default reminder channel', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      await setupNotificationInfrastructure();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_background',
        expect.objectContaining({ name: 'notif_channel_background_name' }),
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_scheduled',
        expect.objectContaining({ name: 'notif_channel_scheduled_name' }),
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_reminders',
        expect.objectContaining({ name: 'notif_channel_name' }),
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({ name: 'notif_channel_name' }),
      );

      (Platform as any).OS = originalOS;
    });

    it('registers all notification action buttons with opensAppToForeground: true', async () => {
      await setupNotificationInfrastructure();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'reminder',
        expect.arrayContaining([
          expect.objectContaining({ options: { opensAppToForeground: true } }),
          expect.objectContaining({ options: { opensAppToForeground: true } }),
          expect.objectContaining({ options: { opensAppToForeground: true } }),
        ]),
      );
    });
  });

  describe('scheduleNextReminder', () => {
    it('does not send a reminder and cancels existing automatic reminders when daily goal is reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
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
        if (key === 'smart_reminders_count') return '2';
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
        if (key === 'smart_reminders_count') return '2';
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
      expect((Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger)
        .toEqual(expect.objectContaining({
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: 'touchgrass_reminders',
        }));
    });

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '0';
        return fallback;
      });

      await scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels remaining smart reminders when goal is reached even if a scheduled notification is nearby', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      // Simulates the path that previously bypassed the goal-reached cancel
      (ScheduledNotifications.hasScheduledNotificationNearby as jest.Mock).mockReturnValue(true);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
      ]);

      await scheduleNextReminder();

      // Must still cancel the automatic reminder despite the scheduled-notification-nearby flag
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto_reminder_1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('scheduled_1_2');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels remaining smart reminders when goal is reached even if a calendar event is upcoming', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      (CalendarService.hasUpcomingEvent as jest.Mock).mockResolvedValue(true);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_morning_reminder' },
      ]);

      await scheduleNextReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto_morning_reminder');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('skips entirely when day reminders are already planned for today', async () => {
      const today = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return today;
        return fallback;
      });
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockReturnValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await scheduleNextReminder();

      // Must not schedule, cancel, or create calendar events when day reminders are active
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });
  });

  describe('scheduleDayReminders', () => {
    it('does nothing when reminders are already planned for today', async () => {
      const today = new Date().toDateString();
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'reminders_last_planned_date') return today;
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Database.setSetting).not.toHaveBeenCalledWith('reminders_last_planned_date', today);
    });

    it('does not schedule any reminders and cancels existing ones when daily goal is already reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
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
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '0';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules reminders using half-hour slots when goal is not yet reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('respects the dynamic count from smart_reminders_count (count=1)', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
      ]);

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      jest.restoreAllMocks();
    });

    it('respects the dynamic count from smart_reminders_count (count=3)', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '3';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 19, minute: 0, score: 0.65, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);

      jest.restoreAllMocks();
    });

    it('sets the trigger date with correct hour AND minute for half-hour slots', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 30, score: 0.75, reason: 'afternoon' },
      ]);

      await scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.DATE);
      const triggerDate: Date = call.trigger.date;

      // Restore mocks before calling getHours/getMinutes on the captured triggerDate,
      // otherwise the spy intercepts those calls too.
      jest.restoreAllMocks();

      expect(triggerDate.getHours()).toBe(14);
      expect(triggerDate.getMinutes()).toBe(30);
    });

    it('skips slots near scheduled notifications (uses isSlotNearScheduledNotification)', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 19, minute: 0, score: 0.65, reason: 'after-work' },
      ]);
      // Mark first slot as near a scheduled notification, allow the other two
      (ScheduledNotifications.isSlotNearScheduledNotification as jest.Mock)
        .mockImplementation((h: number) => h === 12);

      await scheduleDayReminders();

      // Should skip 12:00 and schedule 17:30 and 19:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('creates a calendar event for each scheduled reminder slot', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await scheduleDayReminders();

      // One calendar event per scheduled reminder (2 slots)
      expect(CalendarService.maybeAddOutdoorTimeToCalendar).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('saves reminders_last_planned_date after successful planning', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      expect(Database.setSetting).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString(),
      );

      jest.restoreAllMocks();
    });

    it('saves reminders_last_planned_date when reminders are disabled', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '0';
        return fallback;
      });

      await scheduleDayReminders();

      expect(Database.setSetting).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString(),
      );
    });

    it('saves reminders_last_planned_date when daily goal is already reached', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await scheduleDayReminders();

      expect(Database.setSetting).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString(),
      );
    });

    it('stores planned slots in reminders_planned_slots setting', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
      ]);

      await scheduleDayReminders();

      const slotsCall = (Database.setSetting as jest.Mock).mock.calls.find(
        (call: string[]) => call[0] === 'reminders_planned_slots',
      );
      expect(slotsCall).toBeDefined();
      const slots = JSON.parse(slotsCall![1]);
      expect(slots).toEqual([
        { hour: 12, minute: 0 },
        { hour: 17, minute: 30 },
      ]);

      jest.restoreAllMocks();
    });

    it('resets additional_reminders_today to 0 when planning a new day', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      expect(Database.setSetting).toHaveBeenCalledWith('additional_reminders_today', '0');

      jest.restoreAllMocks();
    });
  });

  describe('maybeScheduleCatchUpReminder', () => {
    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '0';
        return fallback;
      });

      await maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when no planned slots exist', async () => {
      const todayStr = new Date().toDateString();
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return '[]';
        return fallback;
      });

      await maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels remaining smart reminders and stops when daily goal is met', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_14_30' },
        { identifier: 'scheduled_1_3' },
      ]);

      await maybeScheduleCatchUpReminder();

      // No new catch-up reminder scheduled
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Remaining automatic reminder cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto_reminder_14_30');
      // User-configured scheduled notification preserved
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('scheduled_1_3');

      jest.restoreAllMocks();
    });

    it('does nothing when target is already met', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(30);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('schedules a catch-up reminder when behind on goal', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        // Both planned slots have passed (9:00 and 11:00, current time 12:00)
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Database.setSetting).toHaveBeenCalledWith('additional_reminders_today', '1');

      jest.restoreAllMocks();
    });

    it('does not create a calendar event for catch-up reminders', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await maybeScheduleCatchUpReminder();

      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('caps at 2 additional reminders per day', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '2'; // already at max
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });

      await maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('respects isSlotNearScheduledNotification when selecting catch-up slot', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 0, score: 0.7, reason: 'afternoon' },  // near scheduled notif
        { hour: 16, minute: 0, score: 0.65, reason: 'afternoon' }, // clear
      ]);
      (ScheduledNotifications.isSlotNearScheduledNotification as jest.Mock)
        .mockImplementation((h: number) => h === 14);

      await maybeScheduleCatchUpReminder();

      // Should skip 14:00 and use 16:00
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const triggerDate: Date = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger.date;

      // Restore mocks before calling getHours on the captured triggerDate
      jest.restoreAllMocks();

      expect(triggerDate.getHours()).toBe(16);
    });
  });

  describe('calendar integration in scheduleNextReminder', () => {
    it('does not create a calendar event when a reminder is sent (delegated to scheduleDayReminders)', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'currently_outside') return '0';
        if (key === 'last_reminder_ms') return '0';
        return fallback;
      });
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockReturnValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await scheduleNextReminder();

      // scheduleNextReminder fires at arbitrary background-task wake times,
      // so it must never create calendar events (only scheduleDayReminders
      // does, at planned half-hour slots).
      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });

    it('does not create a calendar event when no reminder is sent', async () => {
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '0';
        return fallback;
      });

      await scheduleNextReminder();

      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });
  });

  describe('handleNotificationResponse — modal instead of in-place notification', () => {
    let capturedListener: ((response: any) => Promise<void>) | null = null;

    beforeEach(async () => {
      capturedListener = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock)
        .mockImplementation((listener) => {
          capturedListener = listener;
          return { remove: jest.fn() };
        });
      await setupNotificationInfrastructure();
    });

    it('triggers the feedback modal with went_outside action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      expect(FeedbackContext.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'went_outside',
          confirmBodyKey: 'notif_confirm_went_outside',
        }),
      );
    });

    it('triggers the feedback modal with snoozed action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'snoozed',
      });
      expect(FeedbackContext.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'snoozed',
          confirmBodyKey: 'notif_confirm_snoozed',
        }),
      );
    });

    it('triggers the feedback modal with less_often action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'less_often',
      });
      expect(FeedbackContext.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'less_often',
          confirmBodyKey: 'notif_confirm_less_often',
        }),
      );
    });

    it('does NOT post an in-place confirmation notification when an action is tapped', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      // No scheduleNotificationAsync call with the original identifier and trigger:null
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const inPlaceConfirmationCalls = calls.filter(
        (call: any[]) => call[0]?.identifier === 'notif-abc' && call[0]?.trigger === null,
      );
      expect(inPlaceConfirmationCalls).toHaveLength(0);
    });

    it('dismisses the notification from the tray when an action is tapped', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-abc');
    });

    it('dismisses the notification from the tray even when the body is tapped (dismissed)', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-xyz' } },
        actionIdentifier: 'com.apple.UNNotificationDefaultActionIdentifier',
      });
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-xyz');
    });

    it('does not trigger the modal when the body is tapped (dismissed)', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'com.apple.UNNotificationDefaultActionIdentifier',
      });
      expect(FeedbackContext.triggerReminderFeedbackModal).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules a snooze reminder 30 minutes (not 45) after snoozed action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'snoozed',
      });
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const snoozeCalls = calls.filter(
        (call: any[]) => call[0]?.trigger?.type === Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      );
      expect(snoozeCalls).toHaveLength(1);
      expect(snoozeCalls[0][0].trigger.seconds).toBe(30 * 60);
    });

    it('passes hour and minute to the feedback modal', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });

      expect(FeedbackContext.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({ hour: 14, minute: 30 }),
      );

      jest.restoreAllMocks();
    });
  });

  describe('weather integration', () => {
    it('scheduleDayReminders fetches fresh weather before scoring when weather is enabled', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: true });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true, conditions: [] });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({ allowPermissionPrompt: false });

      jest.restoreAllMocks();
    });

    it('scheduleDayReminders does not fetch weather when weather is disabled', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(10);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('maybeScheduleCatchUpReminder fetches fresh weather before scoring when weather is enabled', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: true });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true, conditions: [] });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await maybeScheduleCatchUpReminder();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({ allowPermissionPrompt: false });

      jest.restoreAllMocks();
    });

    it('maybeScheduleCatchUpReminder does not fetch weather when weather is disabled', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '2';
        if (key === 'reminders_last_planned_date') return todayStr;
        if (key === 'additional_reminders_today') return '0';
        if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }, { hour: 11, minute: 0 }]);
        return fallback;
      });
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await maybeScheduleCatchUpReminder();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('includes weather description and temperature in notification body when weather is enabled and available', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      (WeatherService.isWeatherDataAvailable as jest.Mock).mockReturnValue(true);
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: true });
      (WeatherService.getWeatherForHour as jest.Mock).mockReturnValue({
        temperature: 18,
        weatherCode: 0,
        precipitationProbability: 5,
        cloudCover: 10,
        uvIndex: 3,
        windSpeed: 10,
        isDay: true,
        forecastHour: 12,
        forecastDate: 0,
        timestamp: 0,
      });
      (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('☀️');
      (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('weather_clear_sky');
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true, conditions: [] });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      // Body should include emoji, description, and temperature
      expect(call.content.body).toContain('☀️');
      expect(call.content.body).toContain('weather_clear_sky');
      expect(call.content.body).toContain('18°C');

      jest.restoreAllMocks();
    });

    it('does not append weather to notification body when weather is disabled', async () => {
      (Database.getTodayMinutes as jest.Mock).mockReturnValue(0);
      (Database.getCurrentDailyGoal as jest.Mock).mockReturnValue({ targetMinutes: 30 });
      (Database.getSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
        if (key === 'smart_reminders_count') return '1';
        return fallback;
      });
      (WeatherService.isWeatherDataAvailable as jest.Mock).mockReturnValue(false);
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockReturnValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockReturnValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.content.body).not.toContain('°C');

      jest.restoreAllMocks();
    });
  });
});
