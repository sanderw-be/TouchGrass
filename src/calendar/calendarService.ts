import * as Calendar from 'expo-calendar';
import { getSetting, setSetting } from '../storage/database';
import { t } from '../i18n';

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

    // Sort writable calendars: prefer local-account calendars (most reliable on
    // Android) before sync-account ones (Google, Exchange, etc.) which can
    // reject direct ContentProvider writes depending on account state.
    const writable = [
      ...calendars.filter((c) => c.allowsModifications && c.source?.isLocalAccount),
      ...calendars.filter((c) => c.allowsModifications && !c.source?.isLocalAccount),
    ];

    if (writable.length === 0) {
      console.warn('TouchGrass: No writable calendar found');
      return false;
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const eventTitle = title ?? t('calendar_event_title');
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; // fallback: Hermes can return '' on some Android builds

    const eventDetails = {
      title: eventTitle,
      startDate: startTime,
      endDate: endTime,
      notes: t('calendar_event_notes'),
      timeZone,
      alarms: [], // No calendar notification for TouchGrass-scheduled events
    };

    // Try each calendar in preference order; some accounts reject direct writes.
    for (const cal of writable) {
      try {
        await Calendar.createEventAsync(cal.id, eventDetails);
        return true;
      } catch (calError) {
        console.warn(`TouchGrass: Calendar "${cal.title || cal.id}" rejected write, trying next:`, calError);
      }
    }

    console.warn('TouchGrass: All writable calendars rejected the event');
    return false;
  } catch (e) {
    console.warn('TouchGrass: Failed to add event to calendar:', e);
    return false;
  }
}
