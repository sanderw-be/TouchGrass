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
    // Prefer the default calendar; fall back to the first writable one
    const defaultCalendar =
      calendars.find((c) => c.allowsModifications && c.source?.isLocalAccount) ??
      calendars.find((c) => c.allowsModifications);

    if (!defaultCalendar) {
      console.warn('TouchGrass: No writable calendar found');
      return false;
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const eventTitle = title ?? t('calendar_event_title');

    await Calendar.createEventAsync(defaultCalendar.id, {
      title: eventTitle,
      startDate: startTime,
      endDate: endTime,
      notes: t('calendar_event_notes'),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [], // No calendar notification for TouchGrass-scheduled events
    });

    return true;
  } catch (e) {
    console.warn('TouchGrass: Failed to add event to calendar:', e);
    return false;
  }
}
