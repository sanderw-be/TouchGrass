jest.mock('expo-notifications');
jest.mock('../storage/database');
jest.mock('../notifications/reminderAlgorithm');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');
jest.mock('../i18n', () => ({ t: (key: string) => key }));
jest.mock('../calendar/calendarService', () => ({
  hasUpcomingEvent: jest.fn(() => Promise.resolve(false)),
  maybeAddOutdoorTimeToCalendar: jest.fn(() => Promise.resolve()),
  deleteFutureTouchGrassEvents: jest.fn(() => Promise.resolve()),
}));
jest.mock('../store/useAppStore', () => ({
  triggerReminderFeedbackModal: jest.fn(),
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Database from '../storage/database';
import * as ReminderAlgorithm from '../notifications/reminderAlgorithm';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import * as CalendarService from '../calendar/calendarService';
import * as AppStore from '../store/useAppStore';
import {
  NotificationService,
  FAILSAFE_REMINDER_PREFIX,
} from '../notifications/notificationManager';
import type { ReminderQueueEntry } from '../notifications/notificationManager';

describe('notificationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService._resetSchedulingGuards();

    // Default mock implementations
    (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
    (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
    (Database.getSettingAsync as jest.Mock).mockImplementation(
      async (key: string, fallback: string) => fallback
    );
    (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Database.setSettingAsync as jest.Mock).mockResolvedValue(undefined);
    (WeatherService.isWeatherDataAvailable as jest.Mock).mockResolvedValue(false);
    (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
    (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('🌡️');
    (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('weather_unknown');
    (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({
      success: true,
      conditions: [],
    });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mockResolvedValue(undefined);
    (CalendarService.hasUpcomingEvent as jest.Mock).mockResolvedValue(false);
    (CalendarService.deleteFutureTouchGrassEvents as jest.Mock).mockResolvedValue(undefined);
  });

  describe('setupNotificationInfrastructure', () => {
    it('creates Android channels including the default reminder channel', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      await NotificationService.setupNotificationInfrastructure();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_background',
        expect.objectContaining({ name: 'notif_channel_background_name' })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_scheduled',
        expect.objectContaining({ name: 'notif_channel_scheduled_name' })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_reminders',
        expect.objectContaining({ name: 'notif_channel_name' })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({ name: 'notif_channel_name' })
      );

      (Platform as any).OS = originalOS;
    });

    it('sets showBadge: false for silent channels and showBadge: true for user-facing channels', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      await NotificationService.setupNotificationInfrastructure();

      // Silent channels must NOT show a badge dot
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_background',
        expect.objectContaining({
          showBadge: false,
          importance: Notifications.AndroidImportance.MIN,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_daily_planner',
        expect.objectContaining({
          showBadge: false,
          importance: Notifications.AndroidImportance.MIN,
        })
      );

      // User-facing channels MUST show a badge dot
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_scheduled',
        expect.objectContaining({
          showBadge: true,
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_reminders',
        expect.objectContaining({
          showBadge: true,
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          showBadge: true,
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      );

      (Platform as any).OS = originalOS;
    });

    it('registers all notification action buttons with opensAppToForeground: true', async () => {
      await NotificationService.setupNotificationInfrastructure();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'reminder',
        expect.arrayContaining([
          expect.objectContaining({ options: { opensAppToForeground: true } }),
          expect.objectContaining({ options: { opensAppToForeground: true } }),
          expect.objectContaining({ options: { opensAppToForeground: true } }),
        ])
      );
    });
  });

  describe('scheduleNextReminder', () => {
    it('does not send a reminder and cancels existing automatic reminders when daily goal is reached', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'currently_outside') return '0';
          return fallback;
        }
      );
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockResolvedValue({
        should: false,
        reason: 'daily goal reached',
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
      ]);

      await NotificationService.scheduleNextReminder();

      // Should not schedule a new reminder
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Should cancel the automatic reminder (not the scheduled one)
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_reminder_1'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_2'
      );
    });

    it('does not cancel reminders for other non-goal-reached reasons', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'currently_outside') return '1';
          return fallback;
        }
      );
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockResolvedValue({
        should: false,
        reason: 'currently outside',
      });

      await NotificationService.scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('sends a reminder when goal is not reached and conditions are met', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'currently_outside') return '0';
          if (key === 'last_reminder_ms') return '0';
          return fallback;
        }
      );
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockResolvedValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await NotificationService.scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(
        (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger
      ).toEqual(
        expect.objectContaining({
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: 'touchgrass_reminders',
        })
      );
    });

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleNextReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels remaining smart reminders when goal is reached even if a scheduled notification is nearby', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      // Simulates the path that previously bypassed the goal-reached cancel
      jest.spyOn(NotificationService, 'hasScheduledNotificationNearby').mockResolvedValue(true);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
      ]);

      await NotificationService.scheduleNextReminder();

      // Must still cancel the automatic reminder despite the scheduled-notification-nearby flag
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_reminder_1'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_2'
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels remaining smart reminders when goal is reached even if a calendar event is upcoming', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (CalendarService.hasUpcomingEvent as jest.Mock).mockResolvedValue(true);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_morning_reminder' },
      ]);

      await NotificationService.scheduleNextReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_morning_reminder'
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('skips entirely when day reminders are already planned for today', async () => {
      const today = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return today;
          return fallback;
        }
      );
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockResolvedValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await NotificationService.scheduleNextReminder();

      // Must not schedule, cancel, or create calendar events when day reminders are active
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });
  });

  describe('scheduleDayReminders', () => {
    it('does nothing when reminders are already planned for today', async () => {
      const today = new Date().toDateString();
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'reminders_last_planned_date') return today;
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Database.setSettingAsync).not.toHaveBeenCalledWith(
        'reminders_last_planned_date',
        today
      );
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Daily plan: already planned — queue empty'
      );
    });

    it('does not schedule any reminders and cancels existing ones when daily goal is already reached', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_morning_reminder' },
        { identifier: 'scheduled_1_3' },
      ]);

      await NotificationService.scheduleDayReminders();

      // Should not schedule any new reminders
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Should cancel existing automatic reminders
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_morning_reminder'
      );
      // Should preserve scheduled (user-configured) notifications
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_3'
      );
    });

    it('does not schedule when goal minutes exceeded', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(45);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Daily plan: reminders disabled (count=0)'
      );
    });

    it('schedules reminders using half-hour slots when goal is not yet reached', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await NotificationService.scheduleDayReminders();

      // Count only today's reminders (exclude failsafe_ pre-scheduled triggers for future days)
      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(2);

      jest.restoreAllMocks();
    });

    it('respects the dynamic count from smart_reminders_count (count=1)', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
      ]);

      await NotificationService.scheduleDayReminders();

      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(1);

      jest.restoreAllMocks();
    });

    it('respects the dynamic count from smart_reminders_count (count=3)', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '3';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 19, minute: 0, score: 0.65, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await NotificationService.scheduleDayReminders();

      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(3);

      jest.restoreAllMocks();
    });

    it('sets the trigger with correct hour AND minute for half-hour slots (TIME_INTERVAL)', async () => {
      const settingsStore: Record<string, string> = {};
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.75, reason: 'afternoon' },
      ]);

      await NotificationService.scheduleDayReminders();

      jest.restoreAllMocks();

      // Smart reminders use TIME_INTERVAL (non-exact) — verify trigger type and slot
      const smartCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => arg.identifier?.startsWith('smart_')
      );
      expect(smartCalls).toHaveLength(1);
      expect(smartCalls[0][0].trigger.type).toBe(
        Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
      );
      expect(smartCalls[0][0].trigger.seconds).toBeGreaterThan(0);

      // Slot correctly recorded in queue
      const queue: ReminderQueueEntry[] = JSON.parse(settingsStore['smart_reminder_queue'] ?? '[]');
      const smartEntry = queue.find((e) => e.id.startsWith('smart_'));
      expect(smartEntry?.slotMinutes).toBe(14 * 60 + 30);
    });

    it('skips slots near scheduled notifications (uses isSlotNearScheduledNotification)', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 19, minute: 0, score: 0.65, reason: 'after-work' },
      ]);
      // Mark first slot as near a scheduled notification, allow the other two
      jest
        .spyOn(NotificationService, 'isSlotNearScheduledNotification')
        .mockImplementation((h: number) => Promise.resolve(h === 12));

      await NotificationService.scheduleDayReminders();

      // Should skip 12:00 and schedule 17:30 and 19:00 (exclude failsafe_ calls)
      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(2);

      jest.restoreAllMocks();
    });

    it('creates a calendar event for each scheduled reminder slot', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 8, minute: 0, score: 0.3, reason: 'past' },
      ]);

      await NotificationService.scheduleDayReminders();

      // One calendar event per scheduled reminder slot today (2 slots) plus
      // failsafe events for the next 3 days (2 slots × 3 days = 6), total 8.
      // Check that at least 2 calls are for today's slots (before tomorrow).
      const allCalCalls = (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mock.calls;
      expect(allCalCalls.length).toBeGreaterThanOrEqual(2);

      jest.restoreAllMocks();
    });

    it('saves reminders_last_planned_date after successful planning', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString()
      );

      jest.restoreAllMocks();
    });

    it('saves reminders_last_planned_date when reminders are disabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString()
      );
    });

    it('saves reminders_last_planned_date when daily goal is already reached', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await NotificationService.scheduleDayReminders();

      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString()
      );
    });

    it('stores planned slots in reminders_planned_slots setting', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
      ]);

      await NotificationService.scheduleDayReminders();

      const slotsCall = (Database.setSettingAsync as jest.Mock).mock.calls.find(
        (call: string[]) => call[0] === 'reminders_planned_slots'
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
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      expect(Database.setSettingAsync).toHaveBeenCalledWith('additional_reminders_today', '0');

      jest.restoreAllMocks();
    });

    it('prevents duplicate scheduling when called concurrently (race condition guard)', async () => {
      // Simulate the race: foreground init and background task both call
      // NotificationService.scheduleDayReminders() before either has a chance to persist the date.
      // The fix sets reminders_last_planned_date synchronously (before the first
      // await) so the second concurrent call sees the date and exits early.
      const settingsStore: Record<string, string> = {};
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      // Fire both calls before either has awaited anything.
      const call1 = NotificationService.scheduleDayReminders();
      const call2 = NotificationService.scheduleDayReminders();
      await Promise.all([call1, call2]);

      // Only one notification should have been scheduled for today (not two).
      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(1);

      jest.restoreAllMocks();
    });
  });

  describe('maybeScheduleCatchUpReminder', () => {
    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('logs when no day plan exists yet', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return '';
          return fallback;
        }
      );

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Catch-up skipped — no day plan yet'
      );
    });

    it('does nothing when no planned slots exist', async () => {
      const todayStr = new Date().toDateString();
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots') return '[]';
          return fallback;
        }
      );

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Catch-up skipped — no planned slots'
      );
    });

    it('cancels remaining smart reminders and stops when daily goal is met', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_14_30' },
        { identifier: 'scheduled_1_3' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      // No new catch-up reminder scheduled
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      // Remaining automatic reminder cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_reminder_14_30'
      );
      // User-configured scheduled notification preserved
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_3'
      );

      jest.restoreAllMocks();
    });

    it('does nothing when target is already met', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('schedules a catch-up reminder when behind on goal', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          // Both planned slots have passed (9:00 and 11:00, current time 12:00)
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Database.setSettingAsync).toHaveBeenCalledWith('additional_reminders_today', '1');

      jest.restoreAllMocks();
    });

    it('does not create a calendar event for catch-up reminders', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('caps at smart_catchup_reminders_count additional reminders per day (default 2)', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '2'; // default limit
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '2'; // already at max
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('sends no catch-up reminders when smart_catchup_reminders_count is 0', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '0'; // user reduced to 0
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('caps at 1 additional reminder when smart_catchup_reminders_count is 1', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '1'; // user reduced to 1
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '1'; // already at the new max
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('respects isSlotNearScheduledNotification when selecting catch-up slot', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 0, score: 0.7, reason: 'afternoon' }, // near scheduled notif
        { hour: 16, minute: 0, score: 0.65, reason: 'afternoon' }, // clear
      ]);
      jest
        .spyOn(NotificationService, 'isSlotNearScheduledNotification')
        .mockImplementation((h: number) => Promise.resolve(h === 14));

      await NotificationService.maybeScheduleCatchUpReminder();

      jest.restoreAllMocks();

      // Should skip 14:00 and use 16:00 — verified via the stored slot setting
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'catchup_reminder_slot_minutes',
        String(16 * 60)
      );
    });

    it('does not schedule a catch-up within 60 minutes of the last planned reminder', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          // Planned slot at 11:00; current time is 11:30 (30 min after)
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 11, minute: 0 }]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(11);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('schedules a catch-up after 60 minutes have passed since the last planned reminder', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          // Planned slot at 11:00; current time is 12:01 (61 min after)
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 11, minute: 0 }]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(1);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      jest.restoreAllMocks();
    });

    it('schedules the earliest of the top-n best-scored slots to spread reminders across the day', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '3'; // 3 remaining
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0'; // 3 remaining
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      // Candidates sorted best-first: 17:00 (0.9), 14:00 (0.8), 15:00 (0.7), 20:00 (0.6)
      // Top-3 = [17:00, 14:00, 15:00]; earliest = 14:00
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 17, minute: 0, score: 0.9, reason: 'evening' },
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
        { hour: 15, minute: 0, score: 0.7, reason: 'afternoon' },
        { hour: 20, minute: 0, score: 0.6, reason: 'evening' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      jest.restoreAllMocks();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      // Should pick 14:00 (earliest of top-3) not 17:00 (highest score)
      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'catchup_reminder_slot_minutes',
        String(14 * 60)
      );
    });

    it('clears planned slots and catch-up slot settings when daily goal is reached (maybeScheduleCatchUpReminder)', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Database.setSettingAsync).toHaveBeenCalledWith('reminders_planned_slots', '[]');
      expect(Database.setSettingAsync).toHaveBeenCalledWith('catchup_reminder_slot_minutes', '');

      jest.restoreAllMocks();
    });
  });

  describe('maybeScheduleCatchUpReminder — duplicate slot prevention', () => {
    it('does not schedule a catch-up at a slot already present in the queue', async () => {
      const todayStr = new Date().toDateString();
      // Queue already has a catch-up entry at 14:30 (from a previous tick)
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'catchup_2026-03-30_14:30_123', slotMinutes: 14 * 60 + 30, status: 'date_planned' },
        ]),
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '1';
          if (key === 'smart_catchup_reminders_count') return '2';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      // The algorithm would pick 14:30 again (same slot as already queued)
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.8, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      // 14:30 is already in the queue — must NOT schedule a duplicate
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('schedules a catch-up at a different slot when the first candidate is already queued', async () => {
      const todayStr = new Date().toDateString();
      // Queue already has 14:30
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'catchup_2026-03-30_14:30_123', slotMinutes: 14 * 60 + 30, status: 'date_planned' },
        ]),
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '1';
          if (key === 'smart_catchup_reminders_count') return '2';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      // Algorithm returns 14:30 (queued) and 16:00 (free)
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.9, reason: 'afternoon' }, // already queued — skipped
        { hour: 16, minute: 0, score: 0.7, reason: 'afternoon' }, // free — should be picked
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      jest.restoreAllMocks();

      // 16:00 should have been scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'catchup_reminder_slot_minutes',
        String(16 * 60)
      );
    });
  });

  describe('maybeScheduleCatchUpReminder — consumed-entry 60-min wait', () => {
    it('uses consumed queue entry (not just plannedSlots) for the 60-min wait guard', async () => {
      const todayStr = new Date().toDateString();
      // Queue has a consumed entry at 14:00; current time is 14:30 (30 min after) — should wait
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'consumed' },
        ]),
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          // plannedSlots also reports the 14:00 slot as passed — both sources
          // (consumed queue entry and plannedSlots) agree on the 60-min wait
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 14, minute: 0 }]);
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.maybeScheduleCatchUpReminder();

      // 30 minutes since last reminder — catch-up must be postponed
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  describe('maybeScheduleCatchUpReminder — concurrency guard', () => {
    /** Helper: set up a typical "should schedule" scenario. */
    function setupScheduleScenario(settingsStore: Record<string, string>) {
      const todayStr = new Date().toDateString();
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'smart_catchup_reminders_count') return '2';
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }]);
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.8, reason: 'afternoon' },
      ]);
    }

    it('skips the second call when two calls run concurrently in the same JS runtime', async () => {
      const settingsStore: Record<string, string> = {};
      setupScheduleScenario(settingsStore);

      // Start the first call without awaiting — it runs synchronously until its
      // first `await` (scheduleNotificationAsync) and sets catchUpSchedulingInProgress.
      const firstCall = NotificationService.maybeScheduleCatchUpReminder();
      // The second call starts before the first has finished: the in-progress
      // flag is already true so it must return immediately without scheduling.
      const secondCall = NotificationService.maybeScheduleCatchUpReminder();

      await Promise.all([firstCall, secondCall]);

      jest.restoreAllMocks();

      // Only one notification should have been scheduled.
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Catch-up skipped — concurrent call in progress'
      );
    });

    it('allows a new call after the previous one completes', async () => {
      const settingsStore: Record<string, string> = {};
      setupScheduleScenario(settingsStore);

      await NotificationService.maybeScheduleCatchUpReminder();
      // Reset mocks to simulate a fresh tick with the limit not yet reached.
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return new Date().toDateString();
          if (key === 'additional_reminders_today') return '1';
          if (key === 'smart_catchup_reminders_count') return '2';
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }]);
          if (key === 'smart_reminder_queue') return '[]';
          return fallback;
        }
      );
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 16, minute: 0, score: 0.8, reason: 'afternoon' },
      ]);
      await NotificationService.maybeScheduleCatchUpReminder();

      jest.restoreAllMocks();

      // Both sequential calls should have scheduled a notification.
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('skips scheduling when additional_reminders_today is incremented between reads (cross-runtime guard)', async () => {
      const todayStr = new Date().toDateString();
      let getSetting_callCount = 0;
      // Simulate: first read of additional_reminders_today returns 0 (initial check passes),
      // but by the time we re-read it just before scheduling, another runtime has
      // already incremented it to the limit (1 == catchupLimit).
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'smart_catchup_reminders_count') return '1'; // limit is 1
          if (key === 'additional_reminders_today') {
            getSetting_callCount++;
            // First read (initial limit check) → 0 (below limit, so we proceed).
            // Second read (pre-schedule cross-runtime check) → 1 (at limit, bail out).
            return getSetting_callCount === 1 ? '0' : '1';
          }
          if (key === 'reminders_planned_slots') return JSON.stringify([{ hour: 9, minute: 0 }]);
          if (key === 'smart_reminder_queue') return '[]';
          return fallback;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.8, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      jest.restoreAllMocks();

      // The pre-schedule guard should have caught the cross-runtime race.
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        expect.stringContaining('concurrent cross-runtime call already scheduled')
      );
    });
  });

  describe('cancelRemindersIfGoalReached', () => {
    it('cancels automatic reminders and clears the queue when goal is reached', async () => {
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
          { id: 'catchup_2026-03-30_16:00_123', slotMinutes: 960, status: 'date_planned' },
        ]),
        smart_reminders_count: '2',
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          return key in settingsStore ? settingsStore[key] : fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'smart_2026-03-30_14:00' },
        { identifier: 'scheduled_daily_walk' },
      ]);

      await NotificationService.cancelRemindersIfGoalReached();

      // Automatic reminder cancelled; scheduled notification preserved
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_daily_walk'
      );
      // Queue entries individually cancelled (pending only)
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
      // Queue cleared and settings reset
      expect(JSON.parse(settingsStore['smart_reminder_queue'])).toHaveLength(0);
      expect(Database.setSettingAsync).toHaveBeenCalledWith('reminders_planned_slots', '[]');
      expect(Database.setSettingAsync).toHaveBeenCalledWith('catchup_reminder_slot_minutes', '');
    });

    it('does nothing when goal is not yet reached', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      await NotificationService.cancelRemindersIfGoalReached();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    });

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      await NotificationService.cancelRemindersIfGoalReached();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('skips cancellation for consumed queue entries (already fired)', async () => {
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'smart_2026-03-30_09:00', slotMinutes: 540, status: 'consumed' },
          { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
        ]),
        smart_reminders_count: '2',
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          return key in settingsStore ? settingsStore[key] : fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'smart_2026-03-30_14:00' },
      ]);

      await NotificationService.cancelRemindersIfGoalReached();

      // The consumed entry should NOT be cancelled (it already fired)
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'smart_2026-03-30_09:00'
      );
      // The date_planned entry should be cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
    });
  });

  describe('scheduleNextReminder — goal-reached clears slot settings', () => {
    it('clears planned slots and catch-up slot settings when daily goal is reached', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await NotificationService.scheduleNextReminder();

      expect(Database.setSettingAsync).toHaveBeenCalledWith('reminders_planned_slots', '[]');
      expect(Database.setSettingAsync).toHaveBeenCalledWith('catchup_reminder_slot_minutes', '');
    });
  });

  describe('calendar integration in scheduleNextReminder', () => {
    it('does not create a calendar event when a reminder is sent (delegated to scheduleDayReminders)', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'currently_outside') return '0';
          if (key === 'last_reminder_ms') return '0';
          return fallback;
        }
      );
      (ReminderAlgorithm.shouldRemindNow as jest.Mock).mockResolvedValue({
        should: true,
        reason: 'score 0.65: baseline',
      });

      await NotificationService.scheduleNextReminder();

      // scheduleNextReminder fires at arbitrary background-task wake times,
      // so it must never create calendar events (only scheduleDayReminders
      // does, at planned half-hour slots).
      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });

    it('does not create a calendar event when no reminder is sent', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleNextReminder();

      expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();
    });
  });

  describe('handleNotificationResponse — modal instead of in-place notification', () => {
    let capturedListener: ((response: any) => Promise<void>) | null = null;

    beforeEach(async () => {
      capturedListener = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (listener) => {
          capturedListener = listener;
          return { remove: jest.fn() };
        }
      );
      await NotificationService.setupNotificationInfrastructure();
    });

    it('triggers the feedback modal with went_outside action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      expect(AppStore.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'went_outside',
          confirmBodyKey: 'notif_confirm_went_outside',
        })
      );
    });

    it('triggers the feedback modal with snoozed action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'snoozed',
      });
      expect(AppStore.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'snoozed',
          confirmBodyKey: 'notif_confirm_snoozed',
        })
      );
    });

    it('triggers the feedback modal with less_often action (without confirmBodyKey)', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'less_often',
      });
      expect(AppStore.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'less_often',
        })
      );
      // confirmBodyKey must NOT be present for less_often — the modal shows a choice picker
      const call = (AppStore.triggerReminderFeedbackModal as jest.Mock).mock.calls[0][0];
      expect(call).not.toHaveProperty('confirmBodyKey');
    });

    it('does NOT insert reminder feedback immediately when less_often is tapped', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'less_often',
      });
      expect(Database.insertReminderFeedbackAsync).not.toHaveBeenCalled();
    });

    it('inserts reminder feedback immediately for went_outside action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      expect(Database.insertReminderFeedbackAsync).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'went_outside' })
      );
    });

    it('inserts reminder feedback immediately for snoozed action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'snoozed',
      });
      expect(Database.insertReminderFeedbackAsync).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snoozed' })
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
        (call: any[]) => call[0]?.identifier === 'notif-abc' && call[0]?.trigger === null
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
      expect(AppStore.triggerReminderFeedbackModal).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules a snooze reminder 30 minutes (not 45) after snoozed action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'snoozed',
      });
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const snoozeCalls = calls.filter(
        (call: any[]) =>
          call[0]?.trigger?.type === Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
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

      expect(AppStore.triggerReminderFeedbackModal).toHaveBeenCalledWith(
        expect.objectContaining({ hour: 14, minute: 30 })
      );

      jest.restoreAllMocks();
    });
  });

  describe('weather integration', () => {
    it('scheduleDayReminders fetches fresh weather before scoring when weather is enabled', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({
        success: true,
        conditions: [],
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
        allowPermissionPrompt: false,
      });

      jest.restoreAllMocks();
    });

    it('scheduleDayReminders does not fetch weather when weather is disabled', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('maybeScheduleCatchUpReminder fetches fresh weather before scoring when weather is enabled', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({
        success: true,
        conditions: [],
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
        allowPermissionPrompt: false,
      });

      jest.restoreAllMocks();
    });

    it('maybeScheduleCatchUpReminder does not fetch weather when weather is disabled', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('includes weather description and temperature in notification body when weather is enabled and available', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (WeatherService.isWeatherDataAvailable as jest.Mock).mockResolvedValue(true);
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.getWeatherForHour as jest.Mock).mockResolvedValue({
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
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({
        success: true,
        conditions: [],
      });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      // Body should include emoji and the weather context i18n key (t() is mocked to return the key)
      expect(call.content.body).toContain('☀️');
      expect(call.content.body).toContain('notif_weather_context');

      jest.restoreAllMocks();
    });

    it('does not append weather to notification body when weather is disabled', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (WeatherService.isWeatherDataAvailable as jest.Mock).mockResolvedValue(false);
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
      ]);

      await NotificationService.scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.content.body).not.toContain('°C');

      jest.restoreAllMocks();
    });

    it('appends top contributor description to notification body when contributors are provided', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        {
          hour: 12,
          minute: 0,
          score: 0.8,
          reason: 'lunch',
          contributors: [{ reason: 'lunch', score: 0.1, description: 'notif_reason_lunch' }],
        },
      ]);

      await NotificationService.scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      // First contributor description has its first letter capitalized
      expect(call.content.body).toMatch(/notif_reason_lunch/i);

      jest.restoreAllMocks();
    });

    it('appends top 2 contributor descriptions joined with "and" when 2 contributors are provided', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        {
          hour: 18,
          minute: 0,
          score: 0.9,
          reason: 'after-work, pattern',
          contributors: [
            { reason: 'after_work', score: 0.15, description: 'notif_reason_after_work' },
            { reason: 'pattern', score: 0.1, description: 'notif_reason_pattern' },
          ],
        },
      ]);

      await NotificationService.scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      // First contributor has its first letter capitalized; second is unchanged
      expect(call.content.body).toMatch(/notif_reason_after_work/i);
      expect(call.content.body).toContain('notif_reason_pattern');
      expect(call.content.body).toContain(', notif_contributor_and ');

      jest.restoreAllMocks();
    });

    it('uses weather fallback when no contributors are provided', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      (WeatherService.isWeatherDataAvailable as jest.Mock).mockResolvedValue(true);
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
      (WeatherService.getWeatherForHour as jest.Mock).mockResolvedValue({
        temperature: 22,
        weatherCode: 0,
        precipitationProbability: 0,
        cloudCover: 5,
        uvIndex: 3,
        windSpeed: 5,
        isDay: true,
        forecastHour: 17,
        forecastDate: 0,
        timestamp: 0,
      });
      (WeatherAlgorithm.getWeatherEmoji as jest.Mock).mockReturnValue('☀️');
      (WeatherAlgorithm.getWeatherDescription as jest.Mock).mockReturnValue('weather_clear_sky');
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      // No contributors field in mock → falls back to weather context block
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 17, minute: 0, score: 0.8, reason: 'after-work' },
      ]);

      await NotificationService.scheduleDayReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.content.body).toContain('☀️');
      expect(call.content.body).toContain('notif_weather_context');

      jest.restoreAllMocks();
    });
  });

  describe('setupNotificationInfrastructure — daily planner channel', () => {
    it('creates the touchgrass_daily_planner channel with MIN importance on Android', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      await NotificationService.setupNotificationInfrastructure();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'touchgrass_daily_planner',
        expect.objectContaining({
          name: 'notif_channel_daily_planner_name',
          importance: Notifications.AndroidImportance.MIN,
        })
      );

      (Platform as any).OS = originalOS;
    });
  });

  describe('handleNotificationResponse — daily planner skip', () => {
    it('dismisses a daily planner notification tap but does not insert reminder feedback', async () => {
      // Simulate the notification response listener being registered and called
      // We need to trigger handleNotificationResponse via the listener registration
      // Find the response listener registered during setupNotificationInfrastructure
      await NotificationService.setupNotificationInfrastructure();
      const allCalls = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
        .calls;
      const handler = allCalls[allCalls.length - 1]?.[0];
      if (!handler) return; // guard

      const mockResponse = {
        actionIdentifier: 'com.apple.UNNotificationDefaultActionIdentifier',
        notification: {
          request: {
            identifier: 'daily_planner_4',
            content: {
              title: 'TouchGrass',
              body: 'Planning smart reminders for today, will close when done.',
            },
          },
        },
      };

      await handler(mockResponse);

      // Notification must be dismissed
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('daily_planner_4');
      // Reminder feedback must NOT be inserted
      expect(Database.insertReminderFeedbackAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancelAutomaticReminders — preserves daily planner and failsafe', () => {
    it('does not cancel daily_planner_ or failsafe_reminder_ notifications when cancelling automatic reminders', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
        { identifier: 'daily_planner_4' },
        { identifier: 'failsafe_reminder_2026-03-15_0' },
        { identifier: 'failsafe_reminder_2026-03-16_0' },
      ]);

      // Trigger cancelAutomaticReminders via scheduleNextReminder goal-reached path
      await NotificationService.scheduleNextReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_reminder_1'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_2'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'daily_planner_4'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-15_0'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-16_0'
      );
    });
  });

  describe('scheduleDayReminders — failsafe pre-scheduling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T08:00:00'));

      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback; // lastPlannedDate returns '' → not today
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: false });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('schedules failsafe DATE triggers for the next 3 days using the chosen slots', async () => {
      await NotificationService.scheduleDayReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );

      // At most 2 slots × 3 days = up to 6 failsafe notifications
      expect(failsafeCalls.length).toBeGreaterThan(0);
      expect(failsafeCalls.length).toBeLessThanOrEqual(6);
    });

    it('failsafe notifications use DATE trigger type', async () => {
      await NotificationService.scheduleDayReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );

      for (const [arg] of failsafeCalls) {
        expect(arg.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.DATE);
      }
    });

    it('failsafe notification identifiers encode the target date', async () => {
      await NotificationService.scheduleDayReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeIds = calls
        .filter(([arg]: [any]) => arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX))
        .map(([arg]: [any]) => arg.identifier as string);

      // All identifiers should have a date component in them
      for (const id of failsafeIds) {
        expect(id).toMatch(/^failsafe_reminder_\d{4}-\d{2}-\d{2}_\d+$/);
      }
    });

    it('failsafe notifications cover days 1, 2, and 3 ahead', async () => {
      await NotificationService.scheduleDayReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeIds = calls
        .filter(([arg]: [any]) => arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX))
        .map(([arg]: [any]) => arg.identifier as string);

      const dates = [...new Set(failsafeIds.map((id) => id.split('_')[2]))];
      expect(dates).toContain('2026-03-15');
      expect(dates).toContain('2026-03-16');
      expect(dates).toContain('2026-03-17');
    });

    it('failsafe notifications also create calendar events for future days', async () => {
      await NotificationService.scheduleDayReminders();

      const calendarCalls = (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mock.calls;
      // There should be calendar calls for future days (beyond today = 2026-03-14)
      const tomorrow = new Date('2026-03-15T00:00:00');
      const futureCalls = calendarCalls.filter(
        ([date]: [Date]) => (date as Date).getTime() >= tomorrow.getTime()
      );
      expect(futureCalls.length).toBeGreaterThan(0);
    });

    it('calls deleteFutureTouchGrassEvents to clear stale failsafe calendar events before fresh planning', async () => {
      await NotificationService.scheduleDayReminders();

      expect(CalendarService.deleteFutureTouchGrassEvents).toHaveBeenCalledWith(
        expect.any(Date),
        3 // FAILSAFE_DAYS_AHEAD
      );
    });

    it('calls deleteFutureTouchGrassEvents even when reminders are disabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      expect(CalendarService.deleteFutureTouchGrassEvents).toHaveBeenCalled();
    });

    it('cancels stale failsafe reminders from previous days before scheduling', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'failsafe_reminder_2026-03-10_0' }, // old
        { identifier: 'failsafe_reminder_2026-03-11_0' }, // old
        { identifier: 'auto_reminder_existing' },
      ]);

      await NotificationService.scheduleDayReminders();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-10_0'
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-11_0'
      );
    });

    it('does not schedule failsafe reminders when reminders are disabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.scheduleDayReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(failsafeCalls).toHaveLength(0);
    });
  });

  describe('scheduleDayReminders — queue integration', () => {
    it('clears and rebuilds the queue with date_planned entries using smart_ identifier format', async () => {
      const settingsStore: Record<string, string> = {};
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
      ]);

      await NotificationService.scheduleDayReminders();

      const queueJson = settingsStore['smart_reminder_queue'];
      expect(queueJson).toBeDefined();
      const queue = JSON.parse(queueJson);
      expect(queue).toHaveLength(2);
      expect(queue[0].status).toBe('date_planned');
      expect(queue[0].id).toMatch(/^smart_\d{4}-\d{2}-\d{2}_14:00$/);
      expect(queue[0].slotMinutes).toBe(14 * 60);
      expect(queue[1].id).toMatch(/^smart_\d{4}-\d{2}-\d{2}_17:30$/);
      expect(queue[1].slotMinutes).toBe(17 * 60 + 30);

      jest.restoreAllMocks();
    });

    it('uses the queue entry id as the Expo notification identifier', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
      ]);

      await NotificationService.scheduleDayReminders();

      const todayCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([arg]: [any]) => !arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(todayCalls).toHaveLength(1);
      const identifier = todayCalls[0][0].identifier;
      expect(identifier).toMatch(/^smart_\d{4}-\d{2}-\d{2}_14:00$/);

      jest.restoreAllMocks();
    });

    it('saves an empty queue first then the new entries (clear-then-build)', async () => {
      const setSpy = jest.spyOn(Database, 'setSettingAsync');
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
      ]);

      await NotificationService.scheduleDayReminders();

      const queueCalls = setSpy.mock.calls.filter(([k]) => k === 'smart_reminder_queue');
      // First call should clear the queue, last call should have entries
      expect(queueCalls[0][1]).toBe('[]');
      const lastQueueJson = queueCalls[queueCalls.length - 1][1];
      const lastQueue = JSON.parse(lastQueueJson);
      expect(lastQueue.length).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });
  });

  describe('maybeScheduleCatchUpReminder — queue integration', () => {
    it('appends a date_planned entry with catchup_ identifier to the queue', async () => {
      const settingsStore: Record<string, string> = {
        smart_reminder_queue: JSON.stringify([
          { id: 'smart_2026-03-30_09:00', slotMinutes: 540, status: 'date_planned' },
        ]),
      };
      const todayStr = new Date().toDateString();
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          settingsStore[key] = value;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      const queue = JSON.parse(settingsStore['smart_reminder_queue']);
      expect(queue).toHaveLength(2);
      const catchupEntry = queue[1];
      expect(catchupEntry.status).toBe('date_planned');
      expect(catchupEntry.id).toMatch(/^catchup_\d{4}-\d{2}-\d{2}_14:30_\d+$/);
      expect(catchupEntry.slotMinutes).toBe(14 * 60 + 30);

      jest.restoreAllMocks();
    });

    it('uses the catchup id as the Expo notification identifier', async () => {
      const todayStr = new Date().toDateString();
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'reminders_last_planned_date') return todayStr;
          if (key === 'additional_reminders_today') return '0';
          if (key === 'reminders_planned_slots')
            return JSON.stringify([
              { hour: 9, minute: 0 },
              { hour: 11, minute: 0 },
            ]);
          return fallback;
        }
      );
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 14, minute: 30, score: 0.7, reason: 'afternoon' },
      ]);

      await NotificationService.maybeScheduleCatchUpReminder();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const identifier = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0]
        .identifier;
      expect(identifier).toMatch(/^catchup_\d{4}-\d{2}-\d{2}_14:30_\d+$/);

      jest.restoreAllMocks();
    });
  });

  describe('processReminderQueue', () => {
    function mockSettingsWithQueue(
      queue: ReminderQueueEntry[],
      extra: Record<string, string> = {}
    ) {
      const store: Record<string, string> = {
        smart_reminder_queue: JSON.stringify(queue),
        smart_reminders_count: '2',
        ...extra,
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          return key in store ? store[key] : fallback;
        }
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          store[key] = value;
        }
      );
      return store;
    }

    it('does nothing when reminders are disabled (count = 0)', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when queue is empty', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_reminder_queue') return '[]';
          return fallback;
        }
      );
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      await NotificationService.processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Queue processed — empty'
      );
    });

    it('goal reached → cancels pending queued triggers (not consumed) and clears queue', async () => {
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
        { id: 'smart_2026-03-30_17:30', slotMinutes: 1050, status: 'consumed' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.processReminderQueue();

      // Only the date_planned entry should be cancelled (consumed entries already fired)
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'smart_2026-03-30_17:30'
      );
      expect(JSON.parse(store['smart_reminder_queue'])).toHaveLength(0);
      expect(store['reminders_planned_slots']).toBe('[]');
      expect(store['catchup_reminder_slot_minutes']).toBe('');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('tick-planned parked: date_planned entry within next 15 min stays unchanged (slot not yet passed)', async () => {
      // Now = 13:50, slot = 14:00 (10 minutes ahead — slot has not passed yet)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(13);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(50);

      await NotificationService.processReminderQueue();

      // No cancellation — the TIME_INTERVAL trigger fires natively
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('date_planned');

      jest.restoreAllMocks();
    });

    it('look-ahead: date_planned entry > 15 min ahead → not touched', async () => {
      // Now = 13:30, slot = 14:00 (30 minutes ahead — outside WINDOW)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(13);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue[0].status).toBe('date_planned');

      jest.restoreAllMocks();
    });

    it('look-back: tick_planned entry within last 15 min → TIME_INTERVAL:1 fired and marked consumed', async () => {
      // Now = 14:10, slot = 14:00 (10 minutes ago — within WINDOW)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'tick_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(10);

      await NotificationService.processReminderQueue();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL);
      expect(call.trigger.seconds).toBe(1);

      // Entry is kept as consumed (not removed) for the 60-min catch-up wait guard
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      // Firing a tick_planned reminder must write an activity log entry
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Reminder fired at 14:00'
      );

      jest.restoreAllMocks();
    });

    it('stale tick_planned > 15 min ago → dropped from queue without firing', async () => {
      // Now = 14:30, slot = 14:00 (30 minutes ago — outside WINDOW)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'tick_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.processReminderQueue();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(0);

      jest.restoreAllMocks();
    });

    it('date_planned entry whose slot has passed → marked consumed and kept in queue', async () => {
      // Now = 14:30, slot = 14:00 (30 minutes ago — slot passed, still within 60-min TTL)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.processReminderQueue();

      // No cancellation — notification already fired natively
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      // Entry is kept as consumed (not dropped) for the catch-up 60-min wait guard
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      jest.restoreAllMocks();
    });

    it('consumed entry older than 60 minutes → dropped from queue', async () => {
      // Now = 15:05, slot = 14:00 (65 minutes ago — past 60-min CONSUMED_TTL)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'consumed' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(5);

      await NotificationService.processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(0);

      jest.restoreAllMocks();
    });

    it('consumed entry within 60-minute TTL → kept in queue', async () => {
      // Now = 14:30, slot = 14:00 (30 minutes ago — within 60-min CONSUMED_TTL)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'consumed' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);

      await NotificationService.processReminderQueue();

      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      jest.restoreAllMocks();
    });

    it('future entries are preserved untouched when they are not within any window', async () => {
      // Now = 10:00, slots at 14:00 and 17:00 (both > 15 min ahead)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
        { id: 'smart_2026-03-30_17:00', slotMinutes: 1020, status: 'date_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.processReminderQueue();

      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(2);
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('exact boundary: tick_planned slot exactly at nowMinutes → fired and marked consumed', async () => {
      // Now = 14:00, slot = 14:00 (tick_planned)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'tick_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.processReminderQueue();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      // Entry kept as consumed (not removed) for the 60-min catch-up wait guard
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      // Firing a tick_planned reminder must write an activity log entry
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Reminder fired at 14:00'
      );

      jest.restoreAllMocks();
    });

    it('date_planned entry exactly at nowMinutes → marked consumed (slot just reached)', async () => {
      // Now = 14:00, slot = 14:00 (date_planned, slot time just arrived)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await NotificationService.processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      jest.restoreAllMocks();
    });
  });

  describe('updateUpcomingReminderContent', () => {
    // Helper function to create a mock settings store with queue
    const mockSettingsWithQueue = (queue: ReminderQueueEntry[]): Record<string, string> => {
      const store: Record<string, string> = {
        smart_reminder_queue: JSON.stringify(queue),
        smart_reminders_count: '2',
      };
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => store[key] ?? fallback
      );
      (Database.setSettingAsync as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          store[key] = value;
        }
      );
      return store;
    };

    it('does nothing when reminders are disabled', async () => {
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when queue is empty', async () => {
      mockSettingsWithQueue([]);

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when notification is too far in the future (>30 min)', async () => {
      // Now = 10:00, slot = 11:00 (60 minutes away)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_11:00', slotMinutes: 660, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(5);

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('does nothing when notification has already passed', async () => {
      // Now = 15:00, slot = 14:00 (already passed)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(5);

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('does not update consumed entries', async () => {
      // Now = 14:00, slot = 14:30 (30 minutes away, but consumed)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:30', slotMinutes: 870, status: 'consumed' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(5);

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('updates notification content when scheduled <30 min away with fresh data', async () => {
      // Now = 14:00, slot = 14:20 (20 minutes away)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:20', slotMinutes: 860, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(15); // User has now spent 15 minutes outside
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      // Mock scheduled notification with old content (when user had 0 minutes)
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'smart_2026-03-30_14:20',
          content: { title: 'notif_title_1', body: 'notif_body_none' },
          trigger: { type: 'timeInterval', seconds: 1200 },
        },
      ]);

      await NotificationService.updateUpcomingReminderContent();

      // Should cancel the old notification
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:20'
      );

      // Should reschedule with updated content
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'smart_2026-03-30_14:20',
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String), // New body reflecting 15 minutes done
            categoryIdentifier: 'reminder',
          }),
          trigger: expect.objectContaining({
            type: 'timeInterval',
            seconds: expect.any(Number),
          }),
        })
      );
      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Updated content for 1 reminder(s) within 30 min window'
      );

      jest.restoreAllMocks();
    });

    it('does not update when content has not changed', async () => {
      // Now = 14:00, slot = 14:20 (20 minutes away)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:20', slotMinutes: 860, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      // Mock scheduled notification with current content (matches what would be generated)
      const expectedBody = 'notif_body_none'; // When todayMinutes = 0
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'smart_2026-03-30_14:20',
          content: { title: 'notif_title_1', body: expectedBody },
          trigger: { type: 'timeInterval', seconds: 1200 },
        },
      ]);

      await NotificationService.updateUpcomingReminderContent();

      // Content hasn't changed, so should not cancel or reschedule
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('skips notification not found in scheduled list', async () => {
      // Now = 14:00, slot = 14:20 (20 minutes away)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:20', slotMinutes: 860, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(5);

      // Notification not in scheduled list (already fired or cancelled)
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await NotificationService.updateUpcomingReminderContent();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('updates multiple notifications when multiple are within 30 min window', async () => {
      // Now = 14:00, two slots within 30 min
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:10', slotMinutes: 850, status: 'date_planned' },
        { id: 'smart_2026-03-30_14:25', slotMinutes: 865, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      // Both notifications have old content
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'smart_2026-03-30_14:10',
          content: { title: 'notif_title_1', body: 'notif_body_none' },
          trigger: { type: 'timeInterval', seconds: 600 },
        },
        {
          identifier: 'smart_2026-03-30_14:25',
          content: { title: 'notif_title_2', body: 'notif_body_none' },
          trigger: { type: 'timeInterval', seconds: 1500 },
        },
      ]);

      await NotificationService.updateUpcomingReminderContent();

      // Should update both
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('updates notification at exactly 30 minutes away (boundary case)', async () => {
      // Now = 14:00, slot = 14:30 (exactly 30 minutes away)
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:30', slotMinutes: 870, status: 'date_planned' },
      ];
      mockSettingsWithQueue(queue);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(5);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'smart_2026-03-30_14:30',
          content: { title: 'notif_title_1', body: 'notif_body_none' },
          trigger: { type: 'timeInterval', seconds: 1800 },
        },
      ]);

      await NotificationService.updateUpcomingReminderContent();

      // Should update (30 min is inclusive)
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:30'
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'smart_2026-03-30_14:30',
        })
      );

      jest.restoreAllMocks();
    });
  });
});
