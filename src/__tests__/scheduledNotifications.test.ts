jest.mock('expo-notifications');
jest.mock('../storage');
jest.mock('../i18n', () => ({ t: (key: string) => key }));

import * as Notifications from 'expo-notifications';
import * as Database from '../storage';
import { getScheduledNotificationManager } from '../notifications/notificationManager';
import { createContainer } from '../core/container';

describe('scheduledNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize container with a dummy db
    const mockDb = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
    };
    const container = createContainer(mockDb as any, jest.fn());
    // Link container storageService to Database mocks
    container.storageService.getScheduledNotificationsAsync =
      Database.getScheduledNotificationsAsync as any;

    // Mock permission granted by default
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  });

  describe('scheduleAllScheduledNotifications', () => {
    it('schedules enabled notifications with calendar triggers', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 0, daysOfWeek: [1], enabled: 1, label: 'Morning walk' },
        { id: 2, hour: 18, minute: 30, daysOfWeek: [0], enabled: 0, label: 'Weekend reminder' },
        { id: 3, hour: 10, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Morning walk' },
        { id: 4, hour: 10, minute: 0, daysOfWeek: [5], enabled: 1, label: 'Morning walk' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      // Should schedule 3 notifications (Mon, Wed, Fri)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    });

    it('does not schedule disabled notifications', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 0, daysOfWeek: [1], enabled: 0, label: 'Disabled' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels existing scheduled notifications before scheduling new ones', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 0, daysOfWeek: [1], enabled: 1, label: 'Test' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'scheduled_1_1' },
      ]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('scheduled_1_1');
    });

    it('schedules with correct trigger configuration using WEEKLY trigger', async () => {
      const mockSchedules = [
        { id: 1, hour: 14, minute: 30, daysOfWeek: [2], enabled: 1, label: 'Afternoon reminder' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'scheduled_1_2',
          content: expect.objectContaining({
            title: 'notif_scheduled_title',
            body: 'Afternoon reminder',
          }),
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 3, // JS dayOfWeek 2 (Wednesday) + 1 = 3
            hour: 14,
            minute: 30,
          }),
        })
      );
    });

    it('schedules with correct weekday conversion (JS 0-6 to expo 1-7)', async () => {
      const mockSchedules = [
        { id: 1, hour: 9, minute: 0, daysOfWeek: [0], enabled: 1, label: 'Test' },
        { id: 2, hour: 9, minute: 0, daysOfWeek: [1], enabled: 1, label: 'Test' },
        { id: 3, hour: 9, minute: 0, daysOfWeek: [6], enabled: 1, label: 'Test' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      // Should be called 3 times (Sunday, Monday, Saturday)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;

      // Each call should have WEEKLY trigger with correct weekday/hour/minute
      for (const call of calls) {
        const trigger = call[0].trigger;
        expect(trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.WEEKLY);
        expect(trigger.hour).toBe(9);
        expect(trigger.minute).toBe(0);
        // weekday should be JS dayOfWeek + 1: Sun=1, Mon=2, Sat=7
        expect([1, 2, 7]).toContain(trigger.weekday);
      }
    });

    it('schedules notifications with exact hour and minute via WEEKLY trigger', async () => {
      const mockSchedules = [
        { id: 1, hour: 14, minute: 30, daysOfWeek: [2], enabled: 1, label: 'Exact time test' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0];
      const trigger = call[0].trigger;

      // WEEKLY trigger carries hour and minute directly - no timestamp conversion needed
      expect(trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.WEEKLY);
      expect(trigger.weekday).toBe(3); // Wednesday (JS 2) + 1 = 3
      expect(trigger.hour).toBe(14);
      expect(trigger.minute).toBe(30);
    });

    it('handles scheduling errors gracefully', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 0, daysOfWeek: [1], enabled: 1, label: 'Test' },
        { id: 2, hour: 10, minute: 0, daysOfWeek: [2], enabled: 1, label: 'Test' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
      (Notifications.scheduleNotificationAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce('success');

      // Should not throw, as error is handled internally
      await getScheduledNotificationManager().scheduleAllScheduledNotifications();

      // Should still attempt to schedule the second one
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasScheduledNotificationNearby', () => {
    beforeEach(() => {
      // Mock current time to Wednesday, 10:30
      jest.spyOn(Date.prototype, 'getDay').mockReturnValue(3); // Wednesday
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns true when a schedule is within the window', async () => {
      const mockSchedules = [
        { id: 1, hour: 11, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Nearby' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      const result = await getScheduledNotificationManager().hasScheduledNotificationNearby(60);
      expect(result).toBe(true);
    });

    it('returns false when no schedules are nearby', async () => {
      const mockSchedules = [
        { id: 1, hour: 14, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Far away' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      const result = await getScheduledNotificationManager().hasScheduledNotificationNearby(60);
      expect(result).toBe(false);
    });

    it('returns false when schedule is for a different day', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 30, daysOfWeek: [1], enabled: 1, label: 'Wrong day' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      const result = await getScheduledNotificationManager().hasScheduledNotificationNearby(60);
      expect(result).toBe(false);
    });

    it('ignores disabled schedules', async () => {
      const mockSchedules = [
        { id: 1, hour: 10, minute: 30, daysOfWeek: [3], enabled: 0, label: 'Disabled' },
      ];

      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      const result = await getScheduledNotificationManager().hasScheduledNotificationNearby(60);
      expect(result).toBe(false);
    });
  });

  describe('isSlotNearScheduledNotification', () => {
    beforeEach(() => {
      // Mock today as Wednesday
      jest.spyOn(Date.prototype, 'getDay').mockReturnValue(3);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns true when a slot is within the window of a scheduled notification for today', async () => {
      const mockSchedules = [
        { id: 1, hour: 12, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Lunch' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      // Slot at 12:00 with 30-minute window should match a notification at 12:00
      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(12, 0, 30)
      ).toBe(true);
    });

    it('returns true when a slot is within 30 minutes of a scheduled notification', async () => {
      const mockSchedules = [
        { id: 1, hour: 12, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Lunch' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      // 11:30 is 30 minutes before 12:00 — within window
      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(11, 30, 30)
      ).toBe(true);
    });

    it('returns false when a slot is outside the window', async () => {
      const mockSchedules = [
        { id: 1, hour: 12, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Lunch' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      // 10:00 is 120 minutes before 12:00 — outside 30-minute window
      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(10, 0, 30)
      ).toBe(false);
    });

    it('returns false when the schedule is for a different day of week', async () => {
      const mockSchedules = [
        { id: 1, hour: 12, minute: 0, daysOfWeek: [1], enabled: 1, label: 'Not today' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(12, 0, 30)
      ).toBe(false);
    });

    it('ignores disabled scheduled notifications', async () => {
      const mockSchedules = [
        { id: 1, hour: 12, minute: 0, daysOfWeek: [3], enabled: 0, label: 'Disabled' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(12, 0, 30)
      ).toBe(false);
    });

    it('returns true for a half-hour slot (12:30) near a 13:00 notification within 30-min window', async () => {
      const mockSchedules = [
        { id: 1, hour: 13, minute: 0, daysOfWeek: [3], enabled: 1, label: 'Afternoon' },
      ];
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockSchedules);

      // 12:30 is exactly 30 minutes before 13:00 — on the edge of a 30-min window
      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(12, 30, 30)
      ).toBe(true);
    });

    it('returns false when no scheduled notifications exist', async () => {
      (Database.getScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      expect(
        await getScheduledNotificationManager().isSlotNearScheduledNotification(12, 0, 30)
      ).toBe(false);
    });
  });
});
