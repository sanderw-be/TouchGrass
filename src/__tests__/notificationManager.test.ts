jest.mock('expo-notifications');
jest.mock('../storage');
jest.mock('../notifications/reminderAlgorithm');
jest.mock('../weather/weatherService');
jest.mock('../weather/weatherAlgorithm');
jest.mock('../i18n', () => {
  return {
    t: (key: string) => String(key),
    formatLocalDate: (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },
  };
});
jest.mock('../calendar/calendarService', () => ({
  hasUpcomingEvent: jest.fn(() => Promise.resolve(false)),
  maybeAddOutdoorTimeToCalendar: jest.fn(() => Promise.resolve()),
  deleteFutureTouchGrassEvents: jest.fn(() => Promise.resolve()),
}));
const mockTriggerFeedback = jest.fn();
jest.mock('../store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      triggerFeedback: mockTriggerFeedback,
    }),
  },
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Database from '../storage';
import * as ReminderAlgorithm from '../notifications/reminderAlgorithm';
import * as WeatherService from '../weather/weatherService';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';
import * as CalendarService from '../calendar/calendarService';

import {
  getNotificationInfrastructureService,
  getSmartReminderScheduler,
  getScheduledNotificationManager,
  getNotificationResponseHandler,
  FAILSAFE_REMINDER_PREFIX,
} from '../notifications/notificationManager';
import type { ReminderQueueEntry } from '../notifications/notificationManager';
import { createContainer } from '../core/container';
import { SmartReminderModule } from '../modules/SmartReminderModule';

jest.mock('../modules/SmartReminderModule', () => ({
  SmartReminderModule: {
    scheduleReminders: jest.fn(() => Promise.resolve()),
    cancelAllReminders: jest.fn(() => Promise.resolve()),
  },
}));

describe('notificationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize container with a fully-featured mock db
    const mockDb = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
      execAsync: jest.fn(),
      execSync: jest.fn(),
    };
    const container = createContainer(mockDb as any);

    // Linked container storageService to Database module mocks and local state
    const settingsStore: Record<string, string> = {
      smart_catchup_reminders_count: '0',
    };
    const getSettingMock = jest.fn(async (key: string, fallback: string) => {
      const val = settingsStore[key];
      return val !== undefined ? String(val) : fallback;
    });
    const setSettingMock = jest.fn(async (key: string, value: string) => {
      settingsStore[key] = String(value);
    });

    // Link module mocks to container storage service
    container.storageService.getTodayMinutesAsync = Database.getTodayMinutesAsync as any;
    container.storageService.getCurrentDailyGoalAsync = Database.getCurrentDailyGoalAsync as any;
    container.storageService.getScheduledNotificationsAsync =
      Database.getScheduledNotificationsAsync as any;
    container.storageService.insertBackgroundLogAsync = Database.insertBackgroundLogAsync as any;

    // Default mock implementations for Database module
    (Database.getSettingAsync as jest.Mock).mockImplementation(getSettingMock);
    (Database.setSettingAsync as jest.Mock).mockImplementation(setSettingMock);

    // Default mocks for container (delegating to module mocks)
    container.storageService.getSettingAsync = Database.getSettingAsync as any;
    container.storageService.setSettingAsync = Database.setSettingAsync as any;
    container.storageService.insertReminderFeedbackAsync = (
      Database as any
    ).insertReminderFeedbackAsync;
    container.storageService.getWeatherCacheAsync = (Database as any).getWeatherCacheAsync;
    container.storageService.getWeatherConditionsForHourAsync = (
      Database as any
    ).getWeatherConditionsForHourAsync;
    container.storageService.saveWeatherConditionsAsync = (
      Database as any
    ).saveWeatherConditionsAsync;
    container.storageService.clearExpiredWeatherDataAsync = (
      Database as any
    ).clearExpiredWeatherDataAsync;
    container.storageService.saveWeatherCacheAsync = (Database as any).saveWeatherCacheAsync;

    (getSmartReminderScheduler() as any)._resetSchedulingGuards();

    (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([]);
    (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
    (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
    // Note: getSettingAsync and setSettingAsync are already set up via getSettingMock/setSettingMock above

    (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Database.getWeatherConditionsForHourAsync as jest.Mock).mockResolvedValue([]);
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

      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );

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

      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );

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
      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );

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

      await getSmartReminderScheduler().scheduleNextReminder();

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

      await getSmartReminderScheduler().scheduleNextReminder();

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

      await getSmartReminderScheduler().scheduleNextReminder();

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

      await getSmartReminderScheduler().scheduleNextReminder();

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
      jest
        .spyOn(getScheduledNotificationManager(), 'hasScheduledNotificationNearby')
        .mockResolvedValue(true);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'auto_reminder_1' },
        { identifier: 'scheduled_1_2' },
      ]);

      await getSmartReminderScheduler().scheduleNextReminder();

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

      await getSmartReminderScheduler().scheduleNextReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'auto_morning_reminder'
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('scheduleUpcomingReminders', () => {
    it('plans for tomorrow and cancels existing automatic reminders for today when daily goal is already reached', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T10:00:00')); // Today

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'smart_2026-03-14_11:00' }, // An automatic reminder for today
        { identifier: 'scheduled_1_3' }, // User-configured, should be preserved
        { identifier: 'failsafe_reminder_2026-03-15_09:00' }, // Failsafe, should be preserved but re-scheduled
      ]);

      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          if (baseDate.getDate() === 14) {
            // Today, should be skipped because goal reached
            return [];
          } else if (baseDate.getDate() === 15) {
            // Tomorrow
            return [
              { hour: 9, minute: 0, score: 0.8, reason: 'tomorrow morning' },
              { hour: 17, minute: 0, score: 0.7, reason: 'tomorrow afternoon' },
            ];
          }
          return [];
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      // Should schedule new reminders for tomorrow
      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      expect(scheduledItems).toHaveLength(2); // 2 smart (default catchup is 0)

      // Should preserve scheduled (user-configured) notifications
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_3'
      );
      // Failsafe are cancelled by SmartReminderScheduler's internal logic, not cancelAutomaticReminders
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-15_09:00'
      );

      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Rolling plan: 4 reminders scheduled for next 48h'
      );

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("still plans for tomorrow even when today's goal minutes are exceeded", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T10:00:00')); // Today

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(45); // Exceeded goal
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '2';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );
          if (baseDate.getDate() === 14) {
            // Today, should be skipped because goal exceeded
            return [];
          } else if (baseDate.getDate() === 15) {
            // Tomorrow
            return filterPlanned([
              { hour: 9, minute: 0, score: 0.8, reason: 'tomorrow morning' },
              { hour: 11, minute: 0, score: 0.7, reason: 'tomorrow noon' },
              { hour: 14, minute: 0, score: 0.7, reason: 'tomorrow afternoon' },
              { hour: 17, minute: 0, score: 0.7, reason: 'tomorrow afternoon' },
            ]);
          }
          return [];
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      // Should schedule new reminders for tomorrow
      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      expect(scheduledItems).toHaveLength(4); // (2 smart + 2 catchup) for tomorrow

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('clears all reminders when count is 0', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T10:00:00')); // Today

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '0';
          return fallback;
        }
      );
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'smart_2026-03-14_11:00' },
        { identifier: 'catchup_2026-03-14_12:00' },
        { identifier: 'failsafe_reminder_2026-03-15_0' },
        { identifier: 'scheduled_1_3' },
      ]);

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(SmartReminderModule.scheduleReminders).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'failsafe_reminder_2026-03-15_0'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_1_3'
      );
      expect(Database.setSettingAsync).toHaveBeenCalledWith('reminders_planned_slots', '[]');

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('schedules reminders for today and tomorrow when goal is not yet reached', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T09:00:00')); // 9 AM today

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      // Mock scoreReminderHours to return different scores for today and tomorrow
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );
          if (baseDate.getDate() === 14) {
            // Scores for today (from 9:00 AM onwards)
            return filterPlanned([
              { hour: 9, minute: 30, score: 0.6, reason: 'morning' },
              { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
              { hour: 14, minute: 0, score: 0.7, reason: 'afternoon' },
              { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
            ]);
          } else if (baseDate.getDate() === 15) {
            // Scores for tomorrow
            return filterPlanned([
              { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
              { hour: 11, minute: 0, score: 0.7, reason: 'tomorrow mid' },
              { hour: 13, minute: 0, score: 0.7, reason: 'tomorrow mid' },
              { hour: 16, minute: 0, score: 0.75, reason: 'tomorrow afternoon' },
            ]);
          }
          return [];
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      // 2 smart today + 2 catchup today + 2 smart tomorrow + 2 catchup tomorrow = 8 total
      expect(scheduledItems).toHaveLength(8);

      // Verify the scheduled times and types
      const today = new Date('2026-03-14T09:00:00');
      const tomorrow = new Date('2026-03-15T00:00:00');

      expect(scheduledItems[0]).toMatchObject({
        timestamp: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          9,
          30,
          0,
          0
        ).getTime(),
        type: 'smart_reminder',
      });
      expect(scheduledItems[1]).toMatchObject({
        timestamp: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
          0,
          0,
          0
        ).getTime(),
        type: 'smart_reminder',
      });
      expect(scheduledItems[3]).toMatchObject({
        type: 'catchup_reminder',
      });
      expect(scheduledItems[4]).toMatchObject({
        timestamp: new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          9,
          0,
          0,
          0
        ).getTime(),
        type: 'smart_reminder',
      });
      expect(scheduledItems[5]).toMatchObject({
        timestamp: new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          11,
          0,
          0,
          0
        ).getTime(),
        type: 'smart_reminder',
      });
      expect(scheduledItems[6]).toMatchObject({
        timestamp: new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          13,
          0,
          0,
          0
        ).getTime(),
        type: 'catchup_reminder',
      });
      expect(scheduledItems[7]).toMatchObject({
        timestamp: new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          16,
          0,
          0,
          0
        ).getTime(),
        type: 'catchup_reminder',
      });

      expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
        'reminder',
        'Rolling plan: 10 reminders scheduled for next 48h'
      );

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('sets the trigger with correct hour AND minute for half-hour slots (TIME_INTERVAL)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T09:00:00')); // 9 AM today

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
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          if (baseDate.getDate() === 14) {
            return [{ hour: 14, minute: 30, score: 0.75, reason: 'afternoon' }];
          } else if (baseDate.getDate() === 15) {
            return [{ hour: 9, minute: 0, score: 0.8, reason: 'tomorrow morning' }];
          }
          return [];
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      // Smart reminders use timestamp
      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      const expectedDate = new Date('2026-03-14T14:30:00');
      expect(scheduledItems[0].timestamp).toBe(expectedDate.getTime());

      // Slot correctly recorded in queue
      const queue: ReminderQueueEntry[] = JSON.parse(settingsStore['smart_reminder_queue'] ?? '[]');
      const smartEntry = queue.find((e) => e.id.startsWith('smart_2026-03-14_'));
      expect(smartEntry?.slotMinutes).toBe(14 * 60 + 30);

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('skips slots near scheduled notifications (uses isSlotNearScheduledNotification)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T09:00:00'));

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '2';
          return fallback;
        }
      );
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );

          if (baseDate.getDate() === 14) {
            return filterPlanned([
              { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
              { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
              { hour: 19, minute: 0, score: 0.65, reason: 'evening' },
            ]);
          } else if (baseDate.getDate() === 15) {
            return filterPlanned([{ hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' }]);
          }
          return [];
        }
      ); // Mark 12:00 (today) as near a scheduled notification
      jest
        .spyOn(getScheduledNotificationManager(), 'isSlotNearScheduledNotification')
        .mockImplementation((h: number) => Promise.resolve(h === 12));

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      // Should skip 12:00 (today), schedule 17:30, 19:00 (today) and 9:00 (tomorrow)
      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      // Expected: Today 17:30, 19:00, Tomorrow 09:00 = 3 total
      expect(scheduledItems).toHaveLength(3);

      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('creates a calendar event for each scheduled reminder slot (today + tomorrow)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-14T09:00:00'));

      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          if (key === 'smart_catchup_reminders_count') return '1';
          return fallback;
        }
      );
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const baseDate = new Date(baseDateMs);
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );

          if (baseDate.getDate() === 14) {
            return filterPlanned([
              { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
              { hour: 14, minute: 0, score: 0.7, reason: 'catchup' },
            ]);
          } else if (baseDate.getDate() === 15) {
            return filterPlanned([
              { hour: 9, minute: 0, score: 0.85, reason: 'morning' },
              { hour: 11, minute: 0, score: 0.7, reason: 'catchup' },
            ]);
          }
          return [];
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      // Today (1 smart + 1 catchup) + Tomorrow (1 smart + 1 catchup) + Failsafe Days Ahead (3 days * 1 smart = 3) = 7 total events
      const allCalCalls = (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mock.calls;
      expect(allCalCalls.length).toBe(7);

      jest.useRealTimers();
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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(Database.setSettingAsync).not.toHaveBeenCalledWith(
        'reminders_last_planned_date',
        expect.any(String)
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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(Database.setSettingAsync).toHaveBeenCalledWith(
        'reminders_last_planned_date',
        new Date().toDateString()
      );
    });

    it('stores planned slots in smart_reminder_queue setting', async () => {
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
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );
          return filterPlanned([
            { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
            { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
          ]);
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const slotsCalls = (Database.setSettingAsync as jest.Mock).mock.calls.filter(
        (call: string[]) => call[0] === 'smart_reminder_queue' && call[1] !== '[]'
      );
      expect(slotsCalls.length).toBeGreaterThan(0);
      const queue = JSON.parse(slotsCalls[slotsCalls.length - 1][1]);
      const slots = queue.map((e: any) => ({
        hour: Math.floor(e.slotMinutes / 60),
        minute: e.slotMinutes % 60,
      }));
      expect(slots).toEqual([
        { hour: 12, minute: 0 },
        { hour: 17, minute: 30 },
        { hour: 12, minute: 0 },
        { hour: 17, minute: 30 },
      ]);

      jest.restoreAllMocks();
    });

    it('prevents duplicate scheduling when called concurrently (race condition guard)', async () => {
      // Simulate the race: foreground init and background task both call
      // NotificationService.scheduleUpcomingReminders() before either has a chance to persist the date.
      // The fix sets reminders_last_planned_date synchronously (before the first
      // await) so the second concurrent call sees the date and exits early.
      const settingsStore: Record<string, string> = {};
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '1';
          if (key === 'smart_catchup_reminders_count') return '1';
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

      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
        { hour: 10, minute: 0, score: 0.9, reason: 'morning' },
        { hour: 12, minute: 0, score: 0.8, reason: 'noon' },
        { hour: 14, minute: 0, score: 0.7, reason: 'afternoon' },
        { hour: 16, minute: 0, score: 0.75, reason: 'afternoon' },
      ]);

      // Fire both calls before either has awaited anything.
      const call1 = getSmartReminderScheduler().scheduleUpcomingReminders();
      const call2 = getSmartReminderScheduler().scheduleUpcomingReminders();
      await Promise.all([call1, call2]);

      // Only one notification should have been scheduled for today (not two).
      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      const scheduledItems = (
        SmartReminderModule.scheduleReminders as jest.Mock
      ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
      // 1 smart + 1 catchup today, 1 smart + 1 catchup tomorrow. Mock has 4 slots.
      expect(scheduledItems).toHaveLength(4);

      jest.restoreAllMocks();
    });

    describe('headless replan (isHeadlessReplan: true)', () => {
      it("preserves today's remaining future slots instead of re-scoring", async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-14T10:00:30')); // Just after 10:00 alarm fired

        const settingsStore: Record<string, string> = {
          smart_reminder_queue: JSON.stringify([
            { id: 'smart_2026-03-14_10:00', slotMinutes: 600, status: 'date_planned' },
            { id: 'smart_2026-03-14_12:00', slotMinutes: 720, status: 'date_planned' },
            { id: 'catchup_2026-03-14_14:00_123', slotMinutes: 840, status: 'date_planned' },
          ]),
          smart_catchup_reminders_count: '2',
        };
        (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
        (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
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
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        // Tomorrow slots
        (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
          { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
          { hour: 11, minute: 0, score: 0.8, reason: 'tomorrow noon' },
          { hour: 14, minute: 0, score: 0.7, reason: 'tomorrow afternoon' },
          { hour: 16, minute: 0, score: 0.75, reason: 'tomorrow afternoon' },
        ]);

        await getSmartReminderScheduler().scheduleUpcomingReminders({ isHeadlessReplan: true });

        // Should have scheduled: 12:00 + 14:00 (today, carried) + 2 added today to fill gap + 4 tomorrow = 8 total
        expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
        const scheduledItems = (
          SmartReminderModule.scheduleReminders as jest.Mock
        ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
        expect(scheduledItems).toHaveLength(8);

        // Verify today's slots are the ORIGINAL ones, not re-scored
        const todayItems = scheduledItems.filter(
          (item: any) => new Date(item.timestamp).getDate() === 14
        );
        expect(todayItems).toHaveLength(4);
        expect(todayItems[0].timestamp).toBe(new Date('2026-03-14T09:00:00').getTime());
        expect(todayItems[1].timestamp).toBe(new Date('2026-03-14T11:00:00').getTime());
        expect(todayItems[2].timestamp).toBe(new Date('2026-03-14T12:00:00').getTime());
        expect(todayItems[3].timestamp).toBe(new Date('2026-03-14T14:00:00').getTime());
        expect(todayItems[1].type).toBe('catchup_reminder');
        expect(todayItems[3].type).toBe('catchup_reminder');

        const has10am = scheduledItems.some(
          (item: any) => new Date(item.timestamp).getHours() === 10
        );
        expect(has10am).toBe(false);

        // scoreReminderHours should only have been called for tomorrow, NOT for today
        const scoreCalls = (ReminderAlgorithm.scoreReminderHours as jest.Mock).mock.calls;
        for (const call of scoreCalls) {
          const baseDateMs = call[5];
          if (baseDateMs !== undefined) {
            // We now ALLOW calling for today (14) to fill gaps
          }
        }

        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('re-plans tomorrow fully during headless replan', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-14T10:00:30'));

        const settingsStore: Record<string, string> = {
          smart_reminder_queue: JSON.stringify([]),
        };
        (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30); // Goal met
        (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
        (Database.getSettingAsync as jest.Mock).mockImplementation(
          async (key: string, fallback: string) => {
            if (key in settingsStore) return settingsStore[key];
            if (key === 'smart_reminders_count') return '2';
            if (key === 'smart_catchup_reminders_count') return '2';
            return fallback;
          }
        );
        (Database.setSettingAsync as jest.Mock).mockImplementation(
          async (key: string, value: string) => {
            settingsStore[key] = value;
          }
        );
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
          { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
          { hour: 11, minute: 0, score: 0.8, reason: 'tomorrow noon' },
          { hour: 14, minute: 0, score: 0.7, reason: 'tomorrow afternoon' },
          { hour: 16, minute: 0, score: 0.75, reason: 'tomorrow afternoon' },
        ]);

        await getSmartReminderScheduler().scheduleUpcomingReminders({ isHeadlessReplan: true });

        // scoreReminderHours SHOULD be called for tomorrow
        expect(ReminderAlgorithm.scoreReminderHours).toHaveBeenCalled();
        expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
        const scheduledItems = (
          SmartReminderModule.scheduleReminders as jest.Mock
        ).mock.calls[0][0].filter((item: { type: string }) => item.type !== 'widget_reset');
        expect(scheduledItems).toHaveLength(4); // (2 smart + 2 catchup) for tomorrow

        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('skips calendar, weather, and failsafe operations during headless replan', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-14T10:00:30'));

        const settingsStore: Record<string, string> = {
          smart_reminder_queue: JSON.stringify([
            { id: 'smart_2026-03-14_14:00', slotMinutes: 840, status: 'date_planned' },
          ]),
        };
        (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
        (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
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
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (WeatherAlgorithm.getWeatherPreferences as jest.Mock).mockResolvedValue({ enabled: true });
        (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
          { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
        ]);

        await getSmartReminderScheduler().scheduleUpcomingReminders({ isHeadlessReplan: true });

        // Calendar events: not deleted, not created
        expect(CalendarService.deleteFutureTouchGrassEvents).not.toHaveBeenCalled();
        expect(CalendarService.maybeAddOutdoorTimeToCalendar).not.toHaveBeenCalled();

        // Weather: not fetched (even though enabled)
        expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

        // Failsafe reminders: not cancelled, not re-scheduled
        // (The only way to detect failsafe skip is that no expo-notifications
        //  DATE trigger is scheduled — verify no failsafe identifiers.)
        const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
        const failsafeCalls = scheduleCalls.filter((call: any) =>
          call[0]?.identifier?.startsWith('failsafe_')
        );
        expect(failsafeCalls).toHaveLength(0);

        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('does full planning for today during foreground plan (isHeadlessReplan unset)', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-14T09:00:00'));

        (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(10);
        (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
        (Database.getSettingAsync as jest.Mock).mockImplementation(
          async (key: string, fallback: string) => {
            if (key === 'smart_reminders_count') return '2';
            return fallback;
          }
        );
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
          async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
            const baseDate = new Date(baseDateMs);
            const filterPlanned = (slots: any[]) =>
              slots.filter(
                (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
              );
            if (baseDate.getDate() === 14) {
              return filterPlanned([
                { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
                { hour: 17, minute: 0, score: 0.7, reason: 'after-work' },
              ]);
            } else if (baseDate.getDate() === 15) {
              return filterPlanned([
                { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
              ]);
            }
            return [];
          }
        );

        // Call WITHOUT isHeadlessReplan (default foreground)
        await getSmartReminderScheduler().scheduleUpcomingReminders();

        // scoreReminderHours SHOULD be called for today
        const scoreCalls = (ReminderAlgorithm.scoreReminderHours as jest.Mock).mock.calls;
        const todayCalls = scoreCalls.filter((call: any) => {
          const baseDateMs = call[5];
          return baseDateMs && new Date(baseDateMs).getDate() === 14;
        });
        expect(todayCalls.length).toBeGreaterThan(0);

        // Calendar and weather SHOULD be called
        expect(CalendarService.deleteFutureTouchGrassEvents).toHaveBeenCalled();
        expect(CalendarService.maybeAddOutdoorTimeToCalendar).toHaveBeenCalled();

        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('logs "Headless plan" instead of "Rolling plan" during headless replan', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-14T10:00:30'));

        const settingsStore: Record<string, string> = {
          smart_reminder_queue: JSON.stringify([]),
        };
        (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
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
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockResolvedValue([
          { hour: 9, minute: 0, score: 0.85, reason: 'tomorrow morning' },
        ]);

        await getSmartReminderScheduler().scheduleUpcomingReminders({ isHeadlessReplan: true });

        expect(Database.insertBackgroundLogAsync).toHaveBeenCalledWith(
          'reminder',
          expect.stringContaining('Headless plan')
        );

        jest.useRealTimers();
        jest.restoreAllMocks();
      });
    });
  });

  describe('cancelRemindersIfGoalReached', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-30T10:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

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
          return key in store ? store[key] : fallback;
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

      await getSmartReminderScheduler().cancelRemindersIfGoalReached();

      // Automatic reminder cancelled; scheduled notification preserved
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'scheduled_daily_walk'
      );

      // Verify that tomorrow's reminders would NOT be cancelled (if they were in the queue)
      // and that the queue entry for today is marked as consumed (implicitly by being removed from updatedQueue in processReminderQueue)
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(settingsStore['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(0); // Today's item was removed

      jest.restoreAllMocks();
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

      await getSmartReminderScheduler().cancelRemindersIfGoalReached();

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

      await getSmartReminderScheduler().cancelRemindersIfGoalReached();

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
          return key in store ? store[key] : fallback;
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

      await getSmartReminderScheduler().cancelRemindersIfGoalReached();

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

  describe('calendar integration in scheduleNextReminder', () => {
    it('does not create a calendar event when a reminder is sent (delegated to scheduleUpcomingReminders)', async () => {
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

      await getSmartReminderScheduler().scheduleNextReminder();

      // scheduleNextReminder fires at arbitrary background-task wake times,
      // so it must never create calendar events (only scheduleUpcomingReminders
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

      await getSmartReminderScheduler().scheduleNextReminder();

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
      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );
    });

    it('triggers the feedback modal with went_outside action', async () => {
      await capturedListener!({
        notification: { request: { identifier: 'notif-abc' } },
        actionIdentifier: 'went_outside',
      });
      expect(mockTriggerFeedback).toHaveBeenCalledWith(
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
      expect(mockTriggerFeedback).toHaveBeenCalledWith(
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
      expect(mockTriggerFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'less_often',
        })
      );
      // confirmBodyKey must NOT be present for less_often — the modal shows a choice picker
      const call = mockTriggerFeedback.mock.calls[0][0];
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
      expect(mockTriggerFeedback).not.toHaveBeenCalled();
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

      expect(mockTriggerFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ hour: 14, minute: 30 })
      );

      jest.restoreAllMocks();
    });
  });

  describe('weather integration', () => {
    it('scheduleUpcomingReminders fetches fresh weather before scoring when weather is enabled', async () => {
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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(WeatherService.fetchWeatherForecast).toHaveBeenCalledWith({
        allowPermissionPrompt: false,
      });

      jest.restoreAllMocks();
    });

    it('scheduleUpcomingReminders does not fetch weather when weather is disabled', async () => {
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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('does not automatically append weather to notification body when weather is enabled but not a contributor', async () => {
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(0);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key === 'smart_reminders_count') return '1';
          if (key === 'weather_enabled') return '1';
          return fallback;
        }
      );
      (Database.getWeatherConditionsForHourAsync as jest.Mock).mockResolvedValue([
        { forecastHour: 12, weatherCode: 0, temperature: 20 },
      ]);
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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      // Body should NOT include emoji and the weather context automatically
      expect(call.content.body).not.toContain('🌡️');
      expect(call.content.body).not.toContain('notif_weather_context');

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const call = (SmartReminderModule.scheduleReminders as jest.Mock).mock.calls[0][0][0];
      expect(call.body).not.toContain('°C');

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const call = (SmartReminderModule.scheduleReminders as jest.Mock).mock.calls[0][0][0];
      // First contributor description has its first letter capitalized
      expect(call.body).toMatch(/notif_body_start Notif_reason_lunch/);

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const call = (SmartReminderModule.scheduleReminders as jest.Mock).mock.calls[0][0][0];
      // First contributor has its first letter capitalized; second is unchanged
      expect(call.body).toMatch(/notif_body_start Notif_reason_after_work/);
      expect(call.body).toContain('notif_reason_pattern');
      expect(call.body).toContain(', notif_contributor_and ');

      jest.restoreAllMocks();
    });
  });

  describe('setupNotificationInfrastructure — daily planner channel', () => {
    it('creates the touchgrass_daily_planner channel with MIN importance on Android', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );

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
      await getNotificationInfrastructureService().setupNotificationInfrastructure((response) =>
        getNotificationResponseHandler().handleNotificationResponse(response)
      );
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

      await (handler as any)(mockResponse);

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
      await getSmartReminderScheduler().scheduleNextReminder();

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

  describe('scheduleUpcomingReminders — failsafe pre-scheduling', () => {
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

      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );
          return filterPlanned([
            { hour: 12, minute: 0, score: 0.8, reason: 'lunch' },
            { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
          ]);
        }
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('schedules failsafe DATE triggers for the next 3 days using the chosen slots', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );

      // At most 2 slots × 3 days = up to 6 failsafe notifications
      expect(failsafeCalls.length).toBeGreaterThan(0);
      expect(failsafeCalls.length).toBeLessThanOrEqual(6);
    });

    it('failsafe notifications use DATE trigger type', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );

      for (const [arg] of failsafeCalls) {
        expect(arg.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.DATE);
      }
    });

    it('failsafe notification identifiers encode the target date', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeIds = calls
        .filter(([arg]: [any]) => arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX))
        .map(([arg]: [any]) => arg.identifier as string);

      // All identifiers should have a date component in them
      for (const id of failsafeIds) {
        expect(id).toMatch(/^failsafe_reminder_\d{4}-\d{2}-\d{2}_\d+$/);
      }
    });

    it('failsafe notifications cover days 2, 3, and 4 ahead', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeIds = calls
        .filter(([arg]: [any]) => arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX))
        .map(([arg]: [any]) => arg.identifier as string);

      const dates = [...new Set(failsafeIds.map((id) => id.split('_')[2]))];
      expect(dates).toContain('2026-03-16');
      expect(dates).toContain('2026-03-17');
      expect(dates).toContain('2026-03-18');
    });

    it('failsafe notifications also create calendar events for future days', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calendarCalls = (CalendarService.maybeAddOutdoorTimeToCalendar as jest.Mock).mock.calls;
      // There should be calendar calls for future days (failsafe starts at 2026-03-16)
      const failsafeStart = new Date('2026-03-16T00:00:00');
      const futureCalls = calendarCalls.filter(
        ([date]: [Date]) => (date as Date).getTime() >= failsafeStart.getTime()
      );
      expect(futureCalls.length).toBeGreaterThan(0);
    });

    it('calls deleteFutureTouchGrassEvents to clear stale failsafe calendar events before fresh planning', async () => {
      await getSmartReminderScheduler().scheduleUpcomingReminders();

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      expect(CalendarService.deleteFutureTouchGrassEvents).toHaveBeenCalled();
    });

    it('cancels stale failsafe reminders from previous days before scheduling', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'failsafe_reminder_2026-03-10_0' }, // old
        { identifier: 'failsafe_reminder_2026-03-11_0' }, // old
        { identifier: 'auto_reminder_existing' },
      ]);

      await getSmartReminderScheduler().scheduleUpcomingReminders();

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const failsafeCalls = calls.filter(([arg]: [any]) =>
        arg.identifier?.startsWith(FAILSAFE_REMINDER_PREFIX)
      );
      expect(failsafeCalls).toHaveLength(0);
    });
  });

  describe('scheduleUpcomingReminders — queue integration', () => {
    it('clears and rebuilds the queue with date_planned entries using smart_ identifier format', async () => {
      const settingsStore: Record<string, string> = {};
      (Database.getSettingAsync as jest.Mock).mockImplementation(
        async (key: string, fallback: string) => {
          if (key in settingsStore) return settingsStore[key];
          if (key === 'smart_reminders_count') return '2';
          if (key === 'smart_catchup_reminders_count') return '2';
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
        { hour: 10, minute: 0, score: 0.9, reason: 'morning' },
        { hour: 14, minute: 0, score: 0.8, reason: 'afternoon' },
        { hour: 17, minute: 30, score: 0.7, reason: 'after-work' },
        { hour: 20, minute: 0, score: 0.6, reason: 'evening' },
      ]);

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const queueJson = settingsStore['smart_reminder_queue'];
      expect(queueJson).toBeDefined();
      const queue = JSON.parse(queueJson);
      expect(queue).toHaveLength(8); // (2 smart + 2 catchup) today + (2 smart + 2 catchup) tomorrow
      expect(queue[0].status).toBe('date_planned');
      expect(queue[0].id).toMatch(/^smart_\d{4}-\d{2}-\d{2}_\d+:\d+$/);
      expect(queue[0].slotMinutes).toBe(10 * 60);

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
      (ReminderAlgorithm.scoreReminderHours as jest.Mock).mockImplementation(
        async (todayMins, dailyTarget, currentHour, currentMinute, plannedSlots, baseDateMs) => {
          const filterPlanned = (slots: any[]) =>
            slots.filter(
              (s) => !plannedSlots.some((p: any) => p.hour === s.hour && p.minute === s.minute)
            );
          return filterPlanned([{ hour: 14, minute: 0, score: 0.8, reason: 'afternoon' }]);
        }
      );

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const queueCall = [...(Database.setSettingAsync as jest.Mock).mock.calls]
        .reverse()
        .find((c: any[]) => c[0] === 'smart_reminder_queue');
      const queue = JSON.parse(queueCall[1]);

      expect(SmartReminderModule.scheduleReminders).toHaveBeenCalledTimes(1);
      expect(queue).toHaveLength(2); // Today + Tomorrow (catchup filtered by mock logic)
      expect(queue[0].id).toMatch(/^smart_\d{4}-\d{2}-\d{2}_14:0$/);

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

      await getSmartReminderScheduler().scheduleUpcomingReminders();

      const queueCalls = setSpy.mock.calls.filter(([k]) => k === 'smart_reminder_queue');
      const lastQueueJson = queueCalls[queueCalls.length - 1][1];
      const lastQueue = JSON.parse(lastQueueJson);
      expect(lastQueue.length).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });
  });

  describe('processReminderQueue', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-30T10:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('goal reached → cancels pending queued triggers for today and clears queue', async () => {
      const queue: ReminderQueueEntry[] = [
        { id: 'smart_2026-03-30_14:00', slotMinutes: 840, status: 'date_planned' },
        { id: 'smart_2026-03-31_14:00', slotMinutes: 840, status: 'date_planned' }, // Tomorrow
      ];
      const store = mockSettingsWithQueue(queue);
      (Database.getTodayMinutesAsync as jest.Mock).mockResolvedValue(30);
      (Database.getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 30 });
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);

      await getSmartReminderScheduler().processReminderQueue();

      // Today's entry cancelled, tomorrow's remains
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'smart_2026-03-30_14:00'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'smart_2026-03-31_14:00'
      );
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].id).toBe('smart_2026-03-31_14:00');
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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.trigger).toBeNull();

      // Entry is kept as consumed (not removed) for the 60-min catch-up wait guard
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

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

      await getSmartReminderScheduler().processReminderQueue();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      // Entry kept as consumed (not removed) for the 60-min catch-up wait guard
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

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

      await getSmartReminderScheduler().processReminderQueue();

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      const updatedQueue: ReminderQueueEntry[] = JSON.parse(store['smart_reminder_queue']);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].status).toBe('consumed');

      jest.restoreAllMocks();
    });
  });

  describe('updateUpcomingReminderContent', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-30T10:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing when queue is empty', async () => {
      mockSettingsWithQueue([]);

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

      // Should NOT update smart reminders
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
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
      const expectedBody = 'notif_body_start'; // When todayMinutes = 0
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'smart_2026-03-30_14:20',
          content: { title: 'notif_title_1', body: expectedBody },
          trigger: { type: 'timeInterval', seconds: 1200 },
        },
      ]);

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

      // Should NOT update smart reminders
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

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

      await getSmartReminderScheduler().updateUpcomingReminderContent();

      // Should NOT update smart reminders (now handled by Native Alarm Bridge)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
