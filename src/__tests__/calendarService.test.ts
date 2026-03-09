import * as Calendar from 'expo-calendar';
import {
  requestCalendarPermissions,
  hasCalendarPermissions,
  hasUpcomingEvent,
  addOutdoorTimeToCalendar,
  maybeAddOutdoorTimeToCalendar,
  getWritableCalendars,
  getOrCreateTouchGrassCalendar,
  cleanupTouchGrassCalendars,
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
const mockUpdateCalendar = Calendar.updateCalendarAsync as jest.Mock;

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
    it('creates an event in the TouchGrass calendar', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const start = new Date('2025-06-01T10:00:00');
      const result = await addOutdoorTimeToCalendar(start, 20);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledWith(
        'touchgrass-cal-id',
        expect.objectContaining({
          startDate: start,
          endDate: new Date(start.getTime() + 20 * 60 * 1000),
        }),
      );
    });

    it('writes to TouchGrass calendar even when other calendars exist', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const googleCal = { id: 'google-cal', allowsModifications: true, source: { isLocalAccount: false } };
      const localCal = { id: 'local-cal', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([googleCal, localCal]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledWith('touchgrass-cal-id', expect.anything());
    });

    it('returns false when TouchGrass calendar rejects write with non-fallback error', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal1 = { id: 'local-cal-1', allowsModifications: true, source: { isLocalAccount: true } };
      const localCal2 = { id: 'local-cal-2', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([localCal1, localCal2]);
      // Non-fallback write error (no .code property) — Stage 1 throws immediately, no retry.
      mockCreateEvent.mockRejectedValueOnce(new Error('E_EVENT_NOT_SAVED'));

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(false);
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });

    it('retries with fallback event payload when provider returns E_EVENT_NOT_SAVED', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal = { id: 'local-cal', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([localCal]);
      mockCreateCalendar.mockResolvedValueOnce('touchgrass-cal-id');
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockResolvedValueOnce('event-id-2');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalled();
    });

    it('logs that fallback payload succeeded when calendar debug logging is enabled', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_debug_logging') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal = { id: 'local-cal', allowsModifications: true, source: { isLocalAccount: true }, title: 'Local' };
      mockGetCalendars.mockResolvedValueOnce([localCal]);
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockResolvedValueOnce('event-id-2');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Calendar write debug - event write succeeded'),
        expect.objectContaining({ calendarId: 'touchgrass-cal-id', calendarLabel: 'TouchGrass', payload: 'fallback' }),
      );
      logSpy.mockRestore();
    });

    it('logs TouchGrass label when write succeeds in debug mode', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_debug_logging') return '1';
        return fallback;
      });
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'tg-id', allowsModifications: true }]);
      mockCreateCalendar.mockResolvedValueOnce('tg-id');
      mockCreateEvent.mockResolvedValueOnce('event-id');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Calendar write debug - event write succeeded'),
        expect.objectContaining({ calendarId: 'tg-id', calendarLabel: 'TouchGrass' }),
      );
      logSpy.mockRestore();
    });

    it('falls back to a successful write when a retry sequence eventually succeeds', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal1 = { id: 'local-cal-1', allowsModifications: true, source: { isLocalAccount: true } };
      const localCal2 = { id: 'local-cal-2', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([localCal1, localCal2]);
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockRejectedValueOnce(new Error('fallback event creation failed'))
        .mockResolvedValueOnce('event-id-3');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalled();
    });

    it('succeeds on ultra-minimal payload when primary and fallback are both rejected', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([]);
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockResolvedValueOnce('event-id-ultra');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledTimes(3);
      // ultra-minimal payload omits allDay and timeZone
      const [, ultraMinimalPayload] = mockCreateEvent.mock.calls[2];
      expect(ultraMinimalPayload).not.toHaveProperty('timeZone');
      expect(ultraMinimalPayload).not.toHaveProperty('allDay');
    });

    it('recreates calendar and retries when all payload variants are rejected', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars
        .mockResolvedValueOnce([]) // initial getOrCreateTouchGrassCalendar
        .mockResolvedValueOnce([]) // verify newly created calendar
        .mockResolvedValueOnce([]) // recreate: getOrCreateTouchGrassCalendar
        .mockResolvedValueOnce([]); // verify newly recreated calendar
      mockCreateCalendar
        .mockResolvedValueOnce('touchgrass-cal-id') // initial create
        .mockResolvedValueOnce('touchgrass-cal-id-fresh'); // recreate
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' }) // stage 1
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' }) // stage 2
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' }) // stage 3
        .mockResolvedValueOnce('event-id-after-recreate'); // stage 4

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(true);
      expect(mockCreateCalendar).toHaveBeenCalledTimes(2);
      expect(mockCreateEvent).toHaveBeenCalledTimes(4);
    });

    it('returns false and logs full error when all four write stages fail', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_debug_logging') return '1';
        return fallback;
      });
      mockGetCalendars
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockCreateCalendar
        .mockResolvedValueOnce('touchgrass-cal-id')
        .mockResolvedValueOnce('touchgrass-cal-id-fresh');
      mockCreateEvent
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED' })
        .mockRejectedValueOnce({ code: 'E_EVENT_NOT_SAVED', message: 'final failure', nativeDescription: 'CalendarProvider rejected' });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(result).toBe(false);
      expect(mockCreateEvent).toHaveBeenCalledTimes(4);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('all write stages failed'),
        expect.objectContaining({ errorCode: 'E_EVENT_NOT_SAVED', nativeDescription: 'CalendarProvider rejected' }),
      );
      logSpy.mockRestore();
    });

    it('includes fingerprint in the attempting primary event payload debug log', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_debug_logging') return '1';
        return fallback;
      });
      mockGetCalendars.mockResolvedValueOnce([]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('attempting primary event payload'),
        expect.objectContaining({ fingerprint: expect.stringContaining('|') }),
      );
      logSpy.mockRestore();
    });

    it('returns false when all calendars reject and local TouchGrass calendar cannot be created', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      // No matching TouchGrass calendar found; createCalendarAsync fails (rejects), so
      // getOrCreateTouchGrassCalendar returns null and addOutdoorTimeToCalendar returns false
      // before ever calling createEventAsync.
      const cal1 = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      const cal2 = { id: 'cal2', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([cal1, cal2]);
      mockCreateCalendar.mockRejectedValueOnce(new Error('cannot create calendar'));

      const result = await addOutdoorTimeToCalendar(new Date(), 15);
      expect(result).toBe(false);
    });

    it('requests permissions when not yet granted', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockRequestCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars
        .mockResolvedValueOnce([writable])
        .mockResolvedValueOnce([{ id: 'touchgrass-cal-id', allowsModifications: true }]);
      mockCreateCalendar.mockResolvedValueOnce('touchgrass-cal-id');
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      await addOutdoorTimeToCalendar(new Date(), 15);
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

    it('does not create duplicate event when matching slot already exists', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([{ id: 'touchgrass-cal-id', allowsModifications: true, source: { isLocalAccount: true }, title: 'TouchGrass' }]);
      const start = new Date('2025-06-01T10:00:00');
      const end = new Date(start.getTime() + 15 * 60 * 1000);
      mockGetEvents.mockResolvedValueOnce([
        { title: '🌿 Outdoor time', startDate: start.toISOString(), endDate: end.toISOString() },
      ]);

      const result = await addOutdoorTimeToCalendar(start, 15);
      expect(result).toBe(true);
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
        'touchgrass-cal-id',
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
        'touchgrass-cal-id',
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
      // Legacy calendars get isSynced/isVisible patched
      expect(mockUpdateCalendar).toHaveBeenCalledWith('existing-tg-id', { isSynced: true, isVisible: true });
    });

    it('creates a new calendar when no cached ID is saved (savedId is empty)', async () => {
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id');
      mockGetCalendars
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'new-tg-id', allowsModifications: true }]);

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('new-tg-id');
      expect(mockGetCalendars).toHaveBeenCalledTimes(2);
      expect(mockCreateCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'event',
          title: 'TouchGrass',
          name: 'TouchGrass',
          ownerAccount: 'TouchGrass',
          isSynced: true,
          isVisible: true,
          source: expect.objectContaining({ isLocalAccount: true, name: 'TouchGrass' }),
        }),
      );
      expect(mockSetSetting).toHaveBeenCalledWith('calendar_touchgrass_id', 'new-tg-id');
    });

    it('warns when newly created calendar has allowsModifications=false', async () => {
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id');
      mockGetCalendars
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'new-tg-id', allowsModifications: false, accessLevel: 'read', source: { type: 'local', isLocalAccount: true } }]);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('new-tg-id'); // still returns the id, just logs a warning
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not writable'),
        expect.objectContaining({ allowsModifications: false }),
      );
      warnSpy.mockRestore();
    });

    it('recreates calendar when cached calendar is read-only', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_touchgrass_id') return 'readonly-id';
        return fallback;
      });
      // First getCalendarsAsync: cached calendar exists but is read-only
      mockGetCalendars.mockResolvedValueOnce([{ id: 'readonly-id', allowsModifications: false, accessLevel: 'read', source: { type: 'local', isLocalAccount: true } }]);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id-3');
      // post-creation verification
      mockGetCalendars.mockResolvedValueOnce([{ id: 'new-tg-id-3', allowsModifications: true }]);

      const id = await getOrCreateTouchGrassCalendar();
      expect(id).toBe('new-tg-id-3');
      expect(mockCreateCalendar).toHaveBeenCalled();
    });

    it('creates a new calendar when cached ID no longer exists on device', async () => {
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_touchgrass_id') return 'stale-id';
        return fallback;
      });
      // savedId is non-empty, getCalendarsAsync called but stale-id not found
      mockGetCalendars.mockResolvedValueOnce([{ id: 'other-cal', allowsModifications: true }]);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id-2');
      // post-creation verification
      mockGetCalendars.mockResolvedValueOnce([{ id: 'new-tg-id-2', allowsModifications: true }]);

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
    it('reuses an existing TouchGrass local calendar instead of creating a new one', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetCalendars.mockResolvedValueOnce([
        { id: 'existing-touchgrass-id', allowsModifications: true, title: 'TouchGrass', source: { isLocalAccount: true } },
      ]);
      mockCreateEvent.mockResolvedValueOnce('event-id-tg');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);
      expect(result).toBe(true);
      expect(mockCreateCalendar).not.toHaveBeenCalled();
      expect(mockCreateEvent).toHaveBeenCalledWith('existing-touchgrass-id', expect.anything());
    });

    it('ignores selected calendar and always writes to TouchGrass calendar', async () => {
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
      expect(mockCreateEvent).toHaveBeenCalledWith('touchgrass-cal-id', expect.anything());
    });

    it('prefers TouchGrass calendar over non-local calendars', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const localCal = { id: 'local', allowsModifications: true, source: { isLocalAccount: true }, title: 'Local' };
      const googleCal = { id: 'google', allowsModifications: true, source: { isLocalAccount: false }, title: 'Google' };
      mockGetCalendars.mockResolvedValueOnce([localCal, googleCal]);
      mockCreateEvent.mockResolvedValueOnce('event-id');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);
      expect(result).toBe(true);
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateEvent).toHaveBeenCalledWith('touchgrass-cal-id', expect.anything());
    });

    it('passes allDay: false in event details', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      const writable = { id: 'cal1', allowsModifications: true, source: { isLocalAccount: true } };
      mockGetCalendars.mockResolvedValueOnce([writable]);
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 20);

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'touchgrass-cal-id',
        expect.objectContaining({ allDay: false }),
      );
    });

    it('does not clear cached TouchGrass calendar ID when write attempt completes', async () => {
      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      // No writable calendars at all
      mockGetCalendars.mockResolvedValueOnce([]);
      // getOrCreateTouchGrassCalendar creates a new calendar
      mockCreateCalendar.mockResolvedValueOnce('tg-id');
      mockGetEvents.mockResolvedValueOnce([]);
      // Write succeeds — calendar ID must NOT be cleared by the write path
      mockCreateEvent.mockResolvedValueOnce('event-id-1');

      const result = await addOutdoorTimeToCalendar(new Date('2025-06-01T10:00:00'), 15);
      expect(result).toBe(true);
      expect(mockSetSetting).not.toHaveBeenCalledWith('calendar_touchgrass_id', '');
    });

    it('creates new calendar with isSynced and isVisible', async () => {
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);
      mockCreateCalendar.mockResolvedValueOnce('new-tg-id');
      mockGetCalendars.mockResolvedValueOnce([{ id: 'new-tg-id', allowsModifications: true }]);

      await getOrCreateTouchGrassCalendar();

      expect(mockCreateCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          isSynced: true,
          isVisible: true,
        }),
      );
    });
  });

  describe('cleanupTouchGrassCalendars', () => {
    it('merges duplicate local TouchGrass calendars into one primary calendar', async () => {
      const deleteEventMock = jest.fn().mockResolvedValue(undefined);
      const deleteCalendarMock = jest.fn().mockResolvedValue(undefined);
      (Calendar as any).deleteEventAsync = deleteEventMock;
      (Calendar as any).deleteCalendarAsync = deleteCalendarMock;

      mockGetCalendarPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_touchgrass_id') return 'primary-id';
        return fallback;
      });
      mockGetCalendars.mockResolvedValueOnce([
        { id: 'primary-id', title: 'TouchGrass', name: 'TouchGrass', allowsModifications: true, source: { isLocalAccount: true } },
        { id: 'dup-id', title: 'TouchGrass', name: 'TouchGrass', allowsModifications: true, source: { isLocalAccount: true } },
      ]);
      mockGetEvents
        .mockResolvedValueOnce([
          { id: 'p1', title: '🌿 Outdoor time', startDate: '2025-06-01T10:00:00.000Z', endDate: '2025-06-01T10:15:00.000Z', allDay: false },
        ])
        .mockResolvedValueOnce([
          { id: 'd1', title: '🌿 Outdoor time', startDate: '2025-06-01T10:00:00.000Z', endDate: '2025-06-01T10:15:00.000Z', allDay: false },
          { id: 'd2', title: '🌿 Outdoor time', startDate: '2025-06-01T11:00:00.000Z', endDate: '2025-06-01T11:15:00.000Z', allDay: false },
        ]);
      mockCreateEvent.mockResolvedValue('new-event-id');
      const result = await cleanupTouchGrassCalendars();

      expect(result.primaryCalendarId).toBe('primary-id');
      expect(result.removedCalendars).toBe(1);
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateEvent).toHaveBeenCalledWith(
        'primary-id',
        expect.objectContaining({ title: '🌿 Outdoor time' }),
      );
      expect(deleteCalendarMock).toHaveBeenCalledWith('dup-id');
      expect(mockSetSetting).toHaveBeenCalledWith('calendar_touchgrass_id', 'primary-id');
      expect(mockSetSetting).toHaveBeenCalledWith('calendar_selected_id', 'primary-id');
    });

    it('returns no-op result when calendar permission is not granted', async () => {
      mockGetCalendarPermissions.mockReset();
      mockGetCalendarPermissions.mockResolvedValue({ status: 'denied' });
      mockGetSetting.mockImplementation((_key: string, fallback: string) => fallback);

      const result = await cleanupTouchGrassCalendars();

      expect(result).toEqual({ primaryCalendarId: null, removedCalendars: 0, removedEvents: 0 });
      expect(mockGetCalendars).not.toHaveBeenCalled();
    });
  });
});
