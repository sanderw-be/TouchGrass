import * as Calendar from 'expo-calendar';
import {
  requestCalendarPermissions,
  hasCalendarPermissions,
  hasUpcomingEvent,
  addOutdoorTimeToCalendar,
  maybeAddOutdoorTimeToCalendar,
} from '../calendar/calendarService';

// Mock the database module
jest.mock('../storage/database', () => ({
  getSetting: jest.fn((key: string, fallback: string) => fallback),
  setSetting: jest.fn(),
}));

import { getSetting } from '../storage/database';

const mockGetSetting = getSetting as jest.Mock;
const mockGetCalendarPermissions = Calendar.getCalendarPermissionsAsync as jest.Mock;
const mockRequestCalendarPermissions = Calendar.requestCalendarPermissionsAsync as jest.Mock;
const mockGetCalendars = Calendar.getCalendarsAsync as jest.Mock;
const mockGetEvents = Calendar.getEventsAsync as jest.Mock;
const mockCreateEvent = Calendar.createEventAsync as jest.Mock;

describe('calendarService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: calendar integration disabled
    mockGetSetting.mockImplementation((key: string, fallback: string) => {
      if (key === 'calendar_integration_enabled') return '0';
      return fallback;
    });
  });

  describe('requestCalendarPermissions', () => {
    it('returns true when permission is granted', async () => {
      mockRequestCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const result = await requestCalendarPermissions();
      expect(result).toBe(true);
    });

    it('returns false when permission is denied', async () => {
      mockRequestCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      const result = await requestCalendarPermissions();
      expect(result).toBe(false);
    });

    it('returns false when an error is thrown', async () => {
      mockRequestCalendarPermissions.mockRejectedValueOnce(new Error('Permission error'));
      const result = await requestCalendarPermissions();
      expect(result).toBe(false);
    });
  });

  describe('hasCalendarPermissions', () => {
    it('returns true when status is granted', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const result = await hasCalendarPermissions();
      expect(result).toBe(true);
    });

    it('returns false when status is not granted', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      const result = await hasCalendarPermissions();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetCalendarPermissions.mockRejectedValueOnce(new Error('error'));
      const result = await hasCalendarPermissions();
      expect(result).toBe(false);
    });
  });

  describe('hasUpcomingEvent', () => {
    it('returns false when calendar integration is disabled', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '0';
        return fallback;
      });
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(false);
      expect(mockGetCalendars).not.toHaveBeenCalled();
    });

    it('returns false when permissions are not granted', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(false);
    });

    it('returns false when no calendars are found', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([]);
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(false);
    });

    it('returns false when no events in the window', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([{ id: 'cal1' }]);
      mockGetEvents.mockResolvedValueOnce([]);
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(false);
    });

    it('returns true when an event exists in the window', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([{ id: 'cal1' }]);
      mockGetEvents.mockResolvedValueOnce([{ id: 'evt1', title: 'Meeting' }]);
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockRejectedValueOnce(new Error('Calendar error'));
      const result = await hasUpcomingEvent(30);
      expect(result).toBe(false);
    });
  });

  describe('addOutdoorTimeToCalendar', () => {
    it('creates an event in the first writable calendar', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const start = new Date('2025-06-01T10:00:00');
      const result = await addOutdoorTimeToCalendar(start, 20);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledWith(
        'cal1',
        expect.objectContaining({
          startDate: start,
          endDate: new Date(start.getTime() + 20 * 60 * 1000),
          alarms: [],
        }),
      );
    });

    it('requests permissions when not yet granted', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockRequestCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(true);
      expect(mockRequestCalendarPermissions).toHaveBeenCalled();
    });

    it('returns false when no writable calendar is found', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([{ id: 'cal1', allowsModifications: false }]);

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(false);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('returns false when permissions are denied and cannot be requested', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockRequestCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(false);
    });
  });

  describe('maybeAddOutdoorTimeToCalendar', () => {
    it('does nothing when calendar integration is disabled', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '0';
        return fallback;
      });

      await maybeAddOutdoorTimeToCalendar(new Date());
      expect(mockGetCalendars).not.toHaveBeenCalled();
    });

    it('does nothing when duration is Off (0)', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        if (key === 'calendar_default_duration') return '0';
        return fallback;
      });

      await maybeAddOutdoorTimeToCalendar(new Date());
      expect(mockGetCalendars).not.toHaveBeenCalled();
    });

    it('creates a calendar event when integration is enabled and duration is non-zero', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        if (key === 'calendar_default_duration') return '15';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const start = new Date('2025-06-01T09:00:00');
      await maybeAddOutdoorTimeToCalendar(start);

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'cal1',
        expect.objectContaining({
          startDate: start,
          endDate: new Date(start.getTime() + 15 * 60 * 1000),
        }),
      );
    });

    it('uses the configured duration from settings', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '1';
        if (key === 'calendar_default_duration') return '30';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const start = new Date('2025-06-01T09:00:00');
      await maybeAddOutdoorTimeToCalendar(start);

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'cal1',
        expect.objectContaining({
          endDate: new Date(start.getTime() + 30 * 60 * 1000),
        }),
      );
    });
  });
});
