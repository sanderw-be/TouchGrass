import * as Calendar from 'expo-calendar';
import { getSetting, setSetting } from '../storage/database';
import { t } from '../i18n';

const TOUCHGRASS_CALENDAR_SETTING = 'calendar_touchgrass_id';
const SELECTED_CALENDAR_SETTING = 'calendar_selected_id';
const TOUCHGRASS_CALENDAR_COLOR = '#4CAF50';

function isEventNotSavedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === 'string' && maybeCode === 'E_EVENT_NOT_SAVED';
}

function isCalendarWriteDebugEnabled(): boolean {
  return getSetting('calendar_debug_logging', '0') === '1';
}

function logCalendarWriteDebug(message: string, details?: Record<string, unknown>): void {
  if (!isCalendarWriteDebugEnabled()) return;
  if (details) {
    console.log(`TouchGrass: Calendar write debug - ${message}`, details);
  } else {
    console.log(`TouchGrass: Calendar write debug - ${message}`);
  }
}

/**
 * Request calendar read/write permissions from the user.
 * Returns true if permissions were granted.
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    const granted = status === 'granted';
    setSetting('calendar_permission_granted', granted ? '1' : '0');
    return granted;
  } catch (e) {
    console.warn('TouchGrass: Failed to request calendar permissions:', e);
    return false;
  }
}

/**
 * Check whether calendar permissions are currently granted.
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

/**
 * Return local-account writable calendars available on the device.
 * On Android, only local-account calendars reliably accept direct writes —
 * Google/Exchange sync-account calendars reject ContentProvider inserts
 * regardless of permissions. Sorted alphabetically by title.
 */
export async function getWritableCalendars(): Promise<Calendar.Calendar[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars
      .filter((c) => c.allowsModifications && c.source?.isLocalAccount)
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

/**
 * Get or create a dedicated local "TouchGrass" calendar.
 * On Android, Google/Exchange sync-account calendars reject direct ContentProvider
 * inserts. A local-account calendar is the only guaranteed writable target.
 * The calendar ID is cached in app_settings to avoid creating duplicates.
 */
export async function getOrCreateTouchGrassCalendar(): Promise<string | null> {
  try {
    const savedId = getSetting(TOUCHGRASS_CALENDAR_SETTING, '');
    if (savedId) {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const existing = calendars.find((c) => c.id === savedId);
      if (existing) {
        if (!existing.allowsModifications) {
          console.warn('TouchGrass: Cached TouchGrass calendar is read-only — recreating', {
            allowsModifications: existing.allowsModifications,
            accessLevel: existing.accessLevel,
            sourceType: existing.source?.type,
            isLocal: existing.source?.isLocalAccount,
          });
          // Fall through to recreate
        } else {
          // Ensure isSynced/isVisible are set for calendars created before this fix —
          // without SYNC_EVENTS=1 some Android CalendarProviders reject event inserts.
          try {
            await Calendar.updateCalendarAsync(savedId, { isSynced: true, isVisible: true });
          } catch {
            // Non-critical: best-effort update for legacy calendars
          }
          return savedId;
        }
      }
    }

    const id = await Calendar.createCalendarAsync({
      title: t('calendar_touchgrass_name'),
      color: TOUCHGRASS_CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT, // ensures the calendar accepts event inserts on all Android builds
      name: 'TouchGrass_Internal',
      ownerAccount: 'TouchGrass_App', // must match source.name so Android treats calendar as app-owned and writable
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      isSynced: true, // SYNC_EVENTS=1: required on some Android ROMs for event inserts to succeed
      isVisible: true, // VISIBLE=1: ensures calendar appears in the system calendar app
      source: {
        isLocalAccount: true,
        name: 'TouchGrass_App', // must match ownerAccount
        type: Calendar.SourceType.LOCAL,
      },
    });

    // Verify the newly created calendar is actually writable before caching
    const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const created = allCals.find((c) => c.id === id);
    if (created && !created.allowsModifications) {
      console.warn('TouchGrass: Newly created TouchGrass calendar is not writable', {
        allowsModifications: created.allowsModifications,
        accessLevel: created.accessLevel,
        sourceType: created.source?.type,
        isLocal: created.source?.isLocalAccount,
      });
    }

    setSetting(TOUCHGRASS_CALENDAR_SETTING, id);
    return id;
  } catch (e) {
    console.warn('TouchGrass: Failed to create local TouchGrass calendar:', e);
    return null;
  }
}

/**
 * Return the ID of the calendar the user has chosen to write outdoor events to.
 * Returns an empty string when no preference is saved.
 */
export function getSelectedCalendarId(): string {
  return getSetting(SELECTED_CALENDAR_SETTING, '');
}

/**
 * Persist the user's preferred calendar ID.
 */
export function setSelectedCalendarId(id: string): void {
  setSetting(SELECTED_CALENDAR_SETTING, id);
}


/**
 * Check whether any calendar event starts within the next `windowMinutes` minutes.
 * Used to skip smart reminders when a meeting is imminent.
 */
export async function hasUpcomingEvent(windowMinutes: number): Promise<boolean> {
  const calendarEnabled = getSetting('calendar_integration_enabled', '0') === '1';
  if (!calendarEnabled) return false;

  const permissionGranted = await hasCalendarPermissions();
  if (!permissionGranted) return false;

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) return false;

    const calendarIds = calendars.map((c) => c.id);
    const events = await Calendar.getEventsAsync(calendarIds, now, windowEnd);

    return events.length > 0;
  } catch (e) {
    console.warn('TouchGrass: Failed to check calendar events:', e);
    return false;
  }
}

/**
 * Conditionally add an outdoor time slot to the calendar based on the user's
 * settings.  Does nothing when calendar integration is disabled or the default
 * duration is set to Off (0).  Safe to call fire-and-forget.
 */
export async function maybeAddOutdoorTimeToCalendar(startTime: Date): Promise<void> {
  const enabled = getSetting('calendar_integration_enabled', '0') === '1';
  if (!enabled) return;

  const duration = parseInt(getSetting('calendar_default_duration', '0'), 10);
  if (duration === 0) return;

  await addOutdoorTimeToCalendar(startTime, duration);
}

/**
 * Add an outdoor time slot to the user's default calendar.
 * @param startTime  When the outdoor session should start
 * @param durationMinutes  Length of the session in minutes (5/10/15/20/30)
 * @param title  Optional custom title; falls back to a localised default
 */
export async function addOutdoorTimeToCalendar(
  startTime: Date,
  durationMinutes: number,
  title?: string,
): Promise<boolean> {
  const permissionGranted = await hasCalendarPermissions();
  if (!permissionGranted) {
    const granted = await requestCalendarPermissions();
    if (!granted) return false;
  }

  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Only try local-account calendars — Google/Exchange sync-account calendars
    // always reject direct ContentProvider writes on Android regardless of permission.
    // Prefer the explicitly selected calendar first, then other local-account calendars.
    const selectedId = getSelectedCalendarId();
    const writable = [
      ...calendars.filter((c) => c.allowsModifications && c.id === selectedId && c.source?.isLocalAccount),
      ...calendars.filter((c) => c.allowsModifications && c.id !== selectedId && c.source?.isLocalAccount),
    ];

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const eventTitle = title ?? t('calendar_event_title');
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; // fallback: Hermes can return '' on some Android builds

    const eventDetails = {
      title: eventTitle,
      startDate: startTime,
      endDate: endTime,
      allDay: false, // prevents some Android CalendarProviders from treating events as all-day
      timeZone,
      // Do not pass alarms: [] — an empty array can cause saveEventAsync to fail
      // on some Android ROM variants. Omitting the field means no reminders.
    };
    const fallbackEventDetails = {
      title: eventTitle,
      startDate: startTime,
      endDate: endTime,
      allDay: false,
    };

    const createEventWithFallback = async (calendarId: string, calendarLabel: string): Promise<void> => {
      logCalendarWriteDebug('attempting primary event payload', { calendarId, calendarLabel });
      try {
        await Calendar.createEventAsync(calendarId, eventDetails);
        logCalendarWriteDebug('event write succeeded', { calendarId, calendarLabel, payload: 'primary' });
      } catch (eventError) {
        if (isEventNotSavedError(eventError)) {
          logCalendarWriteDebug('primary payload rejected; retrying fallback payload', { calendarId, calendarLabel });
          try {
            await Calendar.createEventAsync(calendarId, fallbackEventDetails);
            logCalendarWriteDebug('event write succeeded', { calendarId, calendarLabel, payload: 'fallback' });
            return;
          } catch (fallbackError) {
            logCalendarWriteDebug('fallback payload failed', { calendarId, calendarLabel });
            throw fallbackError;
          }
        }
        throw eventError;
      }
    };

    // Try each local-account calendar in preference order.
    for (const cal of writable) {
      try {
        await createEventWithFallback(cal.id, cal.title || cal.id);
        return true;
      } catch (calError) {
        console.warn(`TouchGrass: Calendar "${cal.title || cal.id}" rejected write, trying next:`, calError);
      }
    }

    // Secondary fallback: try non-local writable calendars (Google, Exchange).
    // These reject writes on some devices, but work fine on many others.
    const nonLocal = calendars.filter(
      (c) => c.allowsModifications && !c.source?.isLocalAccount,
    );
    for (const cal of nonLocal) {
      try {
        await createEventWithFallback(cal.id, cal.title || cal.id);
        return true;
      } catch (calError) {
        console.warn(`TouchGrass: Non-local calendar "${cal.title || cal.id}" rejected write, trying next:`, calError);
      }
    }

    // Last resort: write to a guaranteed-writable local calendar owned by this app.
    console.warn('TouchGrass: No existing calendar accepted the write, falling back to local TouchGrass calendar');
    const touchGrassId = await getOrCreateTouchGrassCalendar();
    if (touchGrassId) {
      try {
        await createEventWithFallback(touchGrassId, 'TouchGrass local fallback');
        return true;
      } catch (tgError) {
        // The cached TouchGrass calendar is broken — clear it so the next attempt
        // creates a fresh one with the corrected isSynced/isVisible properties.
        console.warn('TouchGrass: TouchGrass calendar rejected write, clearing cached ID:', tgError);
        setSetting(TOUCHGRASS_CALENDAR_SETTING, '');
      }
    }

    console.warn('TouchGrass: Could not obtain a writable calendar');
    return false;
  } catch (e) {
    console.warn('TouchGrass: Failed to add event to calendar:', e);
    return false;
  }
}
