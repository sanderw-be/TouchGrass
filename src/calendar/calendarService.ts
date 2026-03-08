import * as Calendar from 'expo-calendar';
import { getSetting, setSetting } from '../storage/database';
import { t } from '../i18n';

const TOUCHGRASS_CALENDAR_SETTING = 'calendar_touchgrass_id';
const SELECTED_CALENDAR_SETTING = 'calendar_selected_id';
const PENDING_EVENT_SETTING = 'calendar_pending_event';
const LAST_SUCCESS_FINGERPRINT_SETTING = 'calendar_last_success_fingerprint';
const TOUCHGRASS_CALENDAR_COLOR = '#4CAF50';
const TOUCHGRASS_CALENDAR_NAME = 'TouchGrass';

type PendingCalendarEvent = {
  fingerprint: string;
  startMs: number;
  endMs: number;
  title: string;
  attempts: number;
  lastError?: string;
  lastAttemptMs?: number;
};

function matchesTouchGrassCalendar(calendar: Calendar.Calendar): boolean {
  const title = (calendar.title || '').trim().toLowerCase();
  const name = (calendar.name || '').trim().toLowerCase();
  const ownerAccount = (calendar.ownerAccount || '').trim().toLowerCase();
  const sourceName = (calendar.source?.name || '').trim().toLowerCase();

  if (title.includes('touchgrass')) return true;
  if (name.includes('touchgrass')) return true;
  if (ownerAccount.includes('touchgrass')) return true;
  if (sourceName.includes('touchgrass')) return true;
  return false;
}

function eventDateMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function sameMinute(tsA: number, tsB: number): boolean {
  return Math.abs(tsA - tsB) < 60 * 1000;
}

function eventFingerprint(title: string, startMs: number, endMs: number): string {
  const normalizedTitle = title.trim().toLowerCase();
  const startMinute = Math.floor(startMs / 60000);
  const endMinute = Math.floor(endMs / 60000);
  return `${normalizedTitle}|${startMinute}|${endMinute}`;
}

function readPendingEvent(): PendingCalendarEvent | null {
  const raw = getSetting(PENDING_EVENT_SETTING, '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingCalendarEvent>;
    if (
      typeof parsed.fingerprint === 'string'
      && typeof parsed.startMs === 'number'
      && typeof parsed.endMs === 'number'
      && typeof parsed.title === 'string'
      && typeof parsed.attempts === 'number'
    ) {
      return {
        fingerprint: parsed.fingerprint,
        startMs: parsed.startMs,
        endMs: parsed.endMs,
        title: parsed.title,
        attempts: parsed.attempts,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
        lastAttemptMs: typeof parsed.lastAttemptMs === 'number' ? parsed.lastAttemptMs : undefined,
      };
    }
  } catch {
    // Ignore malformed persisted pending state
  }
  return null;
}

function savePendingEvent(event: PendingCalendarEvent): void {
  setSetting(PENDING_EVENT_SETTING, JSON.stringify(event));
}

function clearPendingEvent(): void {
  setSetting(PENDING_EVENT_SETTING, '');
}

function serializeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'code' in (error as Record<string, unknown>)) {
    const code = (error as { code?: unknown }).code;
    return `code:${String(code)}`;
  }
  return String(error);
}

async function hasDuplicateEvent(
  calendarId: string,
  startTime: Date,
  endTime: Date,
  title: string,
): Promise<boolean> {
  try {
    const from = new Date(startTime.getTime() - 5 * 60 * 1000);
    const to = new Date(endTime.getTime() + 5 * 60 * 1000);
    const events = await Calendar.getEventsAsync([calendarId], from, to);
    const normalizedTitle = title.trim().toLowerCase();

    return events.some((event) => {
      const eventTitle = (event.title || '').trim().toLowerCase();
      const eventStart = eventDateMs(event.startDate);
      const eventEnd = eventDateMs(event.endDate);
      return eventTitle === normalizedTitle
        && sameMinute(eventStart, startTime.getTime())
        && sameMinute(eventEnd, endTime.getTime());
    });
  } catch {
    return false;
  }
}

export interface CalendarCleanupResult {
  primaryCalendarId: string | null;
  removedCalendars: number;
  removedEvents: number;
}

/**
 * Consolidate duplicate local TouchGrass calendars into a single primary one.
 * Migrates unique future events to the primary calendar and removes duplicate
 * events/calendars to prevent repeated clutter.
 */
export async function cleanupTouchGrassCalendars(): Promise<CalendarCleanupResult> {
  const permissionGranted = await hasCalendarPermissions();
  if (!permissionGranted) {
    return { primaryCalendarId: null, removedCalendars: 0, removedEvents: 0 };
  }

  try {
    const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const touchGrassLocalCalendars = allCalendars.filter(
      (calendar) => calendar.source?.isLocalAccount
        && matchesTouchGrassCalendar(calendar),
    );

    const savedId = getSetting(TOUCHGRASS_CALENDAR_SETTING, '');
    const preferred = touchGrassLocalCalendars.find(
      (calendar) => calendar.id === savedId && calendar.allowsModifications,
    );
    const primaryCalendar = preferred
      ?? touchGrassLocalCalendars.find(
        (calendar) => calendar.allowsModifications
          && (calendar.title || '').trim().toLowerCase() === 'touchgrass',
      )
      ?? touchGrassLocalCalendars.find((calendar) => calendar.allowsModifications)
      ?? touchGrassLocalCalendars[0]
      ?? null;

    let primaryCalendarId: string | null = primaryCalendar?.id ?? null;
    if (!primaryCalendarId) {
      primaryCalendarId = await getOrCreateTouchGrassCalendar();
      if (!primaryCalendarId) {
        return { primaryCalendarId: null, removedCalendars: 0, removedEvents: 0 };
      }
    }

    const resolvedPrimaryCalendarId: string = primaryCalendarId;

    setSetting(TOUCHGRASS_CALENDAR_SETTING, resolvedPrimaryCalendarId);
    setSetting(SELECTED_CALENDAR_SETTING, resolvedPrimaryCalendarId);

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    let removedCalendars = 0;
    let removedEvents = 0;

    const primaryEvents = await Calendar.getEventsAsync([resolvedPrimaryCalendarId], from, to);
    const primarySeen = new Set<string>();
    for (const event of primaryEvents) {
      const title = event.title || t('calendar_event_title');
      const startMs = eventDateMs(event.startDate);
      const endMs = eventDateMs(event.endDate);
      if (!startMs || !endMs) continue;

      const fingerprint = eventFingerprint(title, startMs, endMs);
      if (primarySeen.has(fingerprint)) {
        try {
          await Calendar.deleteEventAsync(event.id);
          removedEvents += 1;
        } catch {
          // Best effort only.
        }
      } else {
        primarySeen.add(fingerprint);
      }
    }

    const duplicates = touchGrassLocalCalendars.filter((calendar) => calendar.id !== primaryCalendarId);
    for (const duplicateCalendar of duplicates) {
      try {
        const duplicateEvents = await Calendar.getEventsAsync([duplicateCalendar.id], from, to);
        for (const event of duplicateEvents) {
          const title = event.title || t('calendar_event_title');
          const startMs = eventDateMs(event.startDate);
          const endMs = eventDateMs(event.endDate);
          if (!startMs || !endMs) continue;

          const fingerprint = eventFingerprint(title, startMs, endMs);
          if (!primarySeen.has(fingerprint)) {
            await Calendar.createEventAsync(resolvedPrimaryCalendarId, {
              title,
              startDate: new Date(startMs),
              endDate: new Date(endMs),
              allDay: !!event.allDay,
            });
            primarySeen.add(fingerprint);
          }

          try {
            await Calendar.deleteEventAsync(event.id);
            removedEvents += 1;
          } catch {
            // Best effort only.
          }
        }

        await Calendar.deleteCalendarAsync(duplicateCalendar.id);
        removedCalendars += 1;
      } catch (cleanupError) {
        console.warn('TouchGrass: Failed to clean duplicate calendar:', cleanupError);
      }
    }

    return { primaryCalendarId: resolvedPrimaryCalendarId, removedCalendars, removedEvents };
  } catch (error) {
    console.warn('TouchGrass: Failed to clean TouchGrass calendars:', error);
    return { primaryCalendarId: null, removedCalendars: 0, removedEvents: 0 };
  }
}

function isEventNotSavedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === 'string' && maybeCode === 'E_EVENT_NOT_SAVED';
}

function isCalendarWriteDebugEnabled(): boolean {
  return getSetting('calendar_debug_logging', '1') === '1';
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
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const savedId = getSetting(TOUCHGRASS_CALENDAR_SETTING, '');
    if (savedId) {
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

    const reusable = calendars.find(
      (calendar) => calendar.allowsModifications
        && calendar.source?.isLocalAccount
        && matchesTouchGrassCalendar(calendar),
    );
    if (reusable) {
      try {
        await Calendar.updateCalendarAsync(reusable.id, { isSynced: true, isVisible: true });
      } catch {
        // Non-critical: best-effort update for legacy calendars
      }
      setSetting(TOUCHGRASS_CALENDAR_SETTING, reusable.id);
      return reusable.id;
    }

    const id = await Calendar.createCalendarAsync({
      title: TOUCHGRASS_CALENDAR_NAME,
      color: TOUCHGRASS_CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT, // ensures the calendar accepts event inserts on all Android builds
      name: TOUCHGRASS_CALENDAR_NAME,
      ownerAccount: TOUCHGRASS_CALENDAR_NAME, // must match source.name so Android treats calendar as app-owned and writable
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      isSynced: true, // SYNC_EVENTS=1: required on some Android ROMs for event inserts to succeed
      isVisible: true, // VISIBLE=1: ensures calendar appears in the system calendar app
      source: {
        isLocalAccount: true,
        name: TOUCHGRASS_CALENDAR_NAME, // must match ownerAccount
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
type AddOutdoorTimeOptions = {
  retryingPending?: boolean;
  pending?: PendingCalendarEvent | null;
};

export async function addOutdoorTimeToCalendar(
  startTime: Date,
  durationMinutes: number,
  title?: string,
  options?: AddOutdoorTimeOptions,
): Promise<boolean> {
  const permissionGranted = await hasCalendarPermissions();
  if (!permissionGranted) {
    const granted = await requestCalendarPermissions();
    if (!granted) return false;
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const eventTitle = title ?? t('calendar_event_title');
  const fingerprint = eventFingerprint(eventTitle, startTime.getTime(), endTime.getTime());
  const lastSuccessFingerprint = getSetting(LAST_SUCCESS_FINGERPRINT_SETTING, '');
  if (lastSuccessFingerprint === fingerprint) {
    logCalendarWriteDebug('skipping calendar write — fingerprint already recorded as success', {
      fingerprint,
    });
    clearPendingEvent();
    return true;
  }

  const existingPending =
    options?.pending?.fingerprint === fingerprint
      ? options.pending
      : (() => {
          const pending = readPendingEvent();
          return pending?.fingerprint === fingerprint ? pending : null;
        })();

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

  const basePending: PendingCalendarEvent = {
    fingerprint,
    startMs: startTime.getTime(),
    endMs: endTime.getTime(),
    title: eventTitle,
    attempts: existingPending?.attempts ?? 0,
    lastError: existingPending?.lastError,
    lastAttemptMs: existingPending?.lastAttemptMs,
  };

  if (!options?.retryingPending) {
    savePendingEvent(basePending);
  }

  try {
    const touchGrassId = await getOrCreateTouchGrassCalendar();
    if (!touchGrassId) {
      console.warn('TouchGrass: Could not obtain TouchGrass calendar for writing');
      const pendingFailure: PendingCalendarEvent = {
        ...basePending,
        attempts: basePending.attempts + 1,
        lastError: 'no_calendar_id',
        lastAttemptMs: Date.now(),
      };
      savePendingEvent(pendingFailure);
      return false;
    }

    const createEventWithFallback = async (calendarId: string, calendarLabel: string): Promise<void> => {
      const duplicate = await hasDuplicateEvent(calendarId, startTime, endTime, eventTitle);
      if (duplicate) {
        logCalendarWriteDebug('duplicate event detected; skipping write', {
          calendarId,
          calendarLabel,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventTitle,
          fingerprint,
        });
        clearPendingEvent();
        setSetting(LAST_SUCCESS_FINGERPRINT_SETTING, fingerprint);
        return;
      }

      logCalendarWriteDebug('attempting primary event payload', {
        calendarId,
        calendarLabel,
        fingerprint,
        attempts: basePending.attempts,
      });
      try {
        await Calendar.createEventAsync(calendarId, eventDetails);
        logCalendarWriteDebug('event write succeeded', {
          calendarId,
          calendarLabel,
          payload: 'primary',
          fingerprint,
        });
        clearPendingEvent();
        setSetting(LAST_SUCCESS_FINGERPRINT_SETTING, fingerprint);
      } catch (eventError) {
        if (isEventNotSavedError(eventError)) {
          logCalendarWriteDebug('primary payload rejected; retrying fallback payload', { calendarId, calendarLabel });
          try {
            await Calendar.createEventAsync(calendarId, fallbackEventDetails);
            logCalendarWriteDebug('event write succeeded', {
              calendarId,
              calendarLabel,
              payload: 'fallback',
              fingerprint,
            });
            clearPendingEvent();
            setSetting(LAST_SUCCESS_FINGERPRINT_SETTING, fingerprint);
            return;
          } catch (fallbackError) {
            logCalendarWriteDebug('fallback payload failed', {
              calendarId,
              calendarLabel,
              fingerprint,
              error: serializeError(fallbackError),
            });
            throw fallbackError;
          }
        }
        throw eventError;
      }
    };

    await createEventWithFallback(touchGrassId, TOUCHGRASS_CALENDAR_NAME);
    return true;
  } catch (e) {
    const pendingFailure: PendingCalendarEvent = {
      ...basePending,
      attempts: basePending.attempts + 1,
      lastError: serializeError(e),
      lastAttemptMs: Date.now(),
    };
    savePendingEvent(pendingFailure);
    logCalendarWriteDebug('calendar write failed; pending event retained', {
      fingerprint,
      attempts: pendingFailure.attempts,
      lastError: pendingFailure.lastError,
    });
    console.warn('TouchGrass: Failed to add event to calendar:', e, {
      fingerprint,
      attempts: pendingFailure.attempts,
      lastError: pendingFailure.lastError,
    });
    return false;
  }
}

export async function processPendingCalendarEvents(): Promise<boolean> {
  const pending = readPendingEvent();
  if (!pending) {
    logCalendarWriteDebug('no pending calendar events to process');
    return true;
  }

  const lastSuccessFingerprint = getSetting(LAST_SUCCESS_FINGERPRINT_SETTING, '');
  if (lastSuccessFingerprint === pending.fingerprint) {
    logCalendarWriteDebug('clearing stale pending calendar event — already marked successful', {
      fingerprint: pending.fingerprint,
    });
    clearPendingEvent();
    return true;
  }

  logCalendarWriteDebug('processing pending calendar event', {
    fingerprint: pending.fingerprint,
    attempts: pending.attempts,
    lastError: pending.lastError,
  });

  const start = new Date(pending.startMs);
  const durationMinutes = Math.max(1, Math.round((pending.endMs - pending.startMs) / 60000));

  const success = await addOutdoorTimeToCalendar(start, durationMinutes, pending.title, {
    retryingPending: true,
    pending,
  });

  if (success) {
    clearPendingEvent();
    setSetting(LAST_SUCCESS_FINGERPRINT_SETTING, pending.fingerprint);
  } else {
    logCalendarWriteDebug('pending calendar event retry failed', {
      fingerprint: pending.fingerprint,
      attempts: pending.attempts + 1,
      lastError: pending.lastError,
    });
  }

  // Returning true avoids treating calendar write issues as fatal for the background task loop.
  return true;
}
