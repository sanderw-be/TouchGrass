import * as Calendar from 'expo-calendar';
import {
  requestCalendarPermissions,
  hasCalendarPermissions,
  hasUpcomingEvent,
  addOutdoorTimeToCalendar,
  maybeAddOutdoorTimeToCalendar,
  getWritableCalendars,
  getOrCreateTouchGrassCalendar,
  getSelectedCalendarId,
  setSelectedCalendarId,
} from '../calendar/calendarService';

// Mock the database module
jest.mock('../storage/database', () => ({
  getSetting: jest.fn((key: string, fallback: string) => fallback),
  setSetting: jest.fn(),
}));

import { getSetting, setSetting } from '../storage/database';

const mockGetSetting = getSetting as jest.Mock;
const mockSetSetting = setSetting as jest.Mock;
const mockGetCalendarPermissions = Calendar.getCalendarPermissionsAsync as jest.Mock;
const mockRequestCalendarPermissions = Calendar.requestCalendarPermissionsAsync as jest.Mock;
const mockGetCalendars = Calendar.getCalendarsAsync as jest.Mock;
const mockGetEvents = Calendar.getEventsAsync as jest.Mock;
const mockCreateEvent = Calendar.createEventAsync as jest.Mock;
const mockCreateCalendar = Calendar.createCalendarAsync as jest.Mock;

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

    it('prefers local-account calendars over sync-account calendars', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const googleCal = { id: 'google-cal', allowsModifications: true, source: { isLocalAccount: false } };
      const localCal = { id: 'local-cal', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([googleCal, localCal]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledWith('local-cal', expect.anything());
    });

    it('falls back to the next local calendar when the preferred one rejects the write', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal1 = { id: 'local-cal-1', allowsModifications: true, source: { isLocalAccount: true } };
      const localCal2 = { id: 'local-cal-2', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([localCal1, localCal2]);
      // local-cal-1 tried first but fails; local-cal-2 should be tried next
      mockCreateEvent
        .mockRejectedValueOnce(new Error('E_EVENT_NOT_SAVED'))
        .mockResolvedValueOnce('event-id-2');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledTimes(2);
      expect(mockCreateEvent).toHaveBeenNthCalledWith(1, 'local-cal-1', expect.anything());
      expect(mockCreateEvent).toHaveBeenNthCalledWith(2, 'local-cal-2', expect.anything());
    });

    it('returns false when all calendars reject and local TouchGrass calendar cannot be created', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      // Only local-account calendars are tried; sync-account ones are skipped
      const cal1 = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      const cal2 = { id: 'cal2', allowsModifications: true, source: { isLocalAccount: true } };
      // No saved TouchGrass ID → getOrCreateTouchGrassCalendar skips the getCalendarsAsync call.
      mockGetCalendars.mockResolvedValueOnce([cal1, cal2]);
      mockCreateEvent
        .mockRejectedValueOnce(new Error('E_EVENT_NOT_SAVED'))
        .mockRejectedValueOnce(new Error('E_EVENT_NOT_SAVED'));
      mockCreateCalendar.mockRejectedValueOnce(new Error('cannot create calendar'));

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(false);
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

    it('falls back to TouchGrass local calendar when no writable calendars exist', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      // No writable calendars (only read-only ones); no saved TouchGrass ID so
      // getOrCreateTouchGrassCalendar skips the second getCalendarsAsync call.
      mockGetCalendars.mockResolvedValueOnce([{ id: 'ro', allowsModifications: false }]);
      mockCreateCalendar.mockResolvedValueOnce('local-tg-id');

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(true);
      expect(mockCreateCalendar).toHaveBeenCalled();
      expect(mockCreateEvent).toHaveBeenCalledWith('local-tg-id', expect.anything());
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

  describe('getWritableCalendars', () => {
    it('returns only local-account writable calendars (sync-account excluded)', async () => {
      const readOnly = { id: 'ro', allowsModifications: false, source: { isLocalAccount: false }, title: 'Read Only' };
      const googleCal = { id: 'google', allowsModifications: true, source: { isLocalAccount: false }, title: 'Google' };
      const localCal = { id: 'local', allowsModifications: true, source: { isLocalAccount: true }, title: 'Local' };
      mockGetCalendars.mockResolvedValueOnce([readOnly, googleCal, localCal]);

      const result = await getWritableCalendars();

      expect(result.map((c) => c.id)).toEqual(['local']);
    });

    it('returns empty array when getCalendarsAsync throws', async () => {
      mockGetCalendars.mockRejectedValueOnce(new Error('error'));
      const result = await getWritableCalendars();
      expect(result).toEqual([]);
    });
  });

  describe('getOrCreateTouchGrassCalendar', () => {
    it('returns cached ID when the calendar still exists', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_touchgrass_id') return 'existing-tg-id';
        return fallback;
      });
      // savedId is non-empty, so the function verifies it via getCalendarsAsync
      mockGetCalendars.mockResolvedValueOnce([{ id: 'existing-tg-id', allowsModifications: true }]);

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('existing-tg-id');
      expect(mockCreateCalendar).not.toHaveBeenCalled();
    });

    it('creates a new calendar when no cached ID is saved (savedId is empty)', async () => {
      // savedId = '' → getOrCreateTouchGrassCalendar skips getCalendarsAsync entirely
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id');

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('new-tg-id');
      expect(mockGetCalendars).not.toHaveBeenCalled();
      expect(mockCreateCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'touchgrass',
          ownerAccount: 'local',
          source: expect.objectContaining({ isLocalAccount: true }),
        }),
      );
      expect(mockSetSetting).toHaveBeenCalledWith('calendar_touchgrass_id', 'new-tg-id');
    });

    it('creates a new calendar when cached ID no longer exists on device', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_touchgrass_id') return 'stale-id';
        return fallback;
      });
      // savedId is non-empty, getCalendarsAsync called but stale-id not found
      mockGetCalendars.mockResolvedValueOnce([{ id: 'other-cal', allowsModifications: true }]);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id-2');

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('new-tg-id-2');
    });

    it('returns null when createCalendarAsync throws', async () => {
      // savedId = '' → skips getCalendarsAsync
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      mockCreateCalendar.mockRejectedValueOnce(new Error('create failed'));

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBeNull();
    });
  });

  describe('getSelectedCalendarId / setSelectedCalendarId', () => {
    it('returns empty string when no preference is saved', () => {
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      expect(getSelectedCalendarId()).toBe('');
    });

    it('returns the saved calendar ID', () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_selected_id') return 'my-cal-id';
        return fallback;
      });
      expect(getSelectedCalendarId()).toBe('my-cal-id');
    });

    it('persists the selected calendar ID', () => {
      setSelectedCalendarId('chosen-cal');
      expect(mockSetSetting).toHaveBeenCalledWith('calendar_selected_id', 'chosen-cal');
    });
  });

  describe('addOutdoorTimeToCalendar — TouchGrass local fallback', () => {
    it('skips sync-account calendars and falls back to TouchGrass when no local calendars exist', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      // Only a sync-account calendar exists; it should be skipped entirely
      const googleCal = { id: 'google', allowsModifications: true, source: { isLocalAccount: false }, title: 'Google' };
      // No saved TouchGrass ID → getOrCreateTouchGrassCalendar skips getCalendarsAsync.
      mockGetCalendars.mockResolvedValueOnce([googleCal]);
      mockCreateCalendar.mockResolvedValueOnce('tg-fallback-id');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);
      expect(result).toBe(true);
      expect(mockCreateCalendar).toHaveBeenCalled();
      // google-cal should never have been tried
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateEvent).toHaveBeenCalledWith('tg-fallback-id', expect.anything());
    });

    it('uses user-selected local calendar first when set', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_selected_id') return 'preferred-cal';
        return fallback;
      });
      // preferred-cal must be a local-account calendar to be included in the write list
      const preferred = { id: 'preferred-cal', allowsModifications: true, source: { isLocalAccount: true }, title: 'Preferred' };
      const other = { id: 'other-cal', allowsModifications: true, source: { isLocalAccount: true }, title: 'Other' };
      mockGetCalendars.mockResolvedValueOnce([preferred, other]);
      mockCreateEvent.mockResolvedValueOnce('event-id');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);
      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateEvent).toHaveBeenCalledWith('preferred-cal', expect.anything());
    });
  });
});
