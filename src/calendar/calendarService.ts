import * as Calendar from 'expo-calendar';
import { AppState } from 'react-native';
import { getSettingAsync, setSettingAsync } from '../storage';
import { t } from '../i18n';

const TOUCHGRASS_CALENDAR_SETTING = 'calendar_touchgrass_id';
const SELECTED_CALENDAR_SETTING = 'calendar_selected_id';
const TOUCHGRASS_CALENDAR_COLOR = '#4CAF50';
const TOUCHGRASS_CALENDAR_NAME = 'TouchGrass';

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

async function hasDuplicateEvent(
  calendarId: string,
  startTime: Date,
  endTime: Date,
  title: string
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
      return (
        eventTitle === normalizedTitle &&
        sameMinute(eventStart, startTime.getTime()) &&
        sameMinute(eventEnd, endTime.getTime())
      );
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
      (calendar) => calendar.source?.isLocalAccount && matchesTouchGrassCalendar(calendar)
    );

    const savedId = await getSettingAsync(TOUCHGRASS_CALENDAR_SETTING, '');
    const preferred = touchGrassLocalCalendars.find(
      (calendar) => calendar.id === savedId && calendar.allowsModifications
    );
    const primaryCalendar =
      preferred ??
      touchGrassLocalCalendars.find(
        (calendar) =>
          calendar.allowsModifications &&
          (calendar.title || '').trim().toLowerCase() === 'touchgrass'
      ) ??
      touchGrassLocalCalendars.find((calendar) => calendar.allowsModifications) ??
      touchGrassLocalCalendars[0] ??
      null;

    let primaryCalendarId: string | null = primaryCalendar?.id ?? null;
    if (!primaryCalendarId) {
      primaryCalendarId = await getOrCreateTouchGrassCalendar();
      if (!primaryCalendarId) {
        return { primaryCalendarId: null, removedCalendars: 0, removedEvents: 0 };
      }
    }

    const resolvedPrimaryCalendarId: string = primaryCalendarId;

    await setSettingAsync(TOUCHGRASS_CALENDAR_SETTING, resolvedPrimaryCalendarId);
    await setSettingAsync(SELECTED_CALENDAR_SETTING, resolvedPrimaryCalendarId);

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

    const duplicates = touchGrassLocalCalendars.filter(
      (calendar) => calendar.id !== primaryCalendarId
    );
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

async function isCalendarWriteDebugEnabled(): Promise<boolean> {
  return (await getSettingAsync('calendar_debug_logging', '0')) === '1';
}

async function logCalendarWriteDebug(
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const enabled = await isCalendarWriteDebugEnabled();
  if (!enabled) return;
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
export async function requestCalendarPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const { status, canAskAgain } = await Calendar.requestCalendarPermissionsAsync();
    const granted = status === 'granted';
    await setSettingAsync('calendar_permission_granted', granted ? '1' : '0');
    return { granted, canAskAgain };
  } catch (e) {
    console.warn('TouchGrass: Failed to request calendar permissions:', e);
    return { granted: false, canAskAgain: true };
  }
}

/**
 * Check whether calendar permissions are currently granted.
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch {
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
 *
 * @param forceCreate  When true, skip all existing-calendar lookups and always
 *   create a brand-new calendar.  Use this when write attempts to the currently
 *   cached calendar have all failed — e.g. because that calendar was created by a
 *   different build of the app (different signing keys) and the Android
 *   CalendarProvider is silently rejecting inserts from the new UID.
 */
export async function getOrCreateTouchGrassCalendar(forceCreate = false): Promise<string | null> {
  try {
    if (!forceCreate) {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const savedId = await getSettingAsync(TOUCHGRASS_CALENDAR_SETTING, '');
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
        (calendar) =>
          calendar.allowsModifications &&
          calendar.source?.isLocalAccount &&
          matchesTouchGrassCalendar(calendar)
      );
      if (reusable) {
        try {
          await Calendar.updateCalendarAsync(reusable.id, { isSynced: true, isVisible: true });
        } catch {
          // Non-critical: best-effort update for legacy calendars
        }
        await setSettingAsync(TOUCHGRASS_CALENDAR_SETTING, reusable.id);
        return reusable.id;
      }
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

    await setSettingAsync(TOUCHGRASS_CALENDAR_SETTING, id);
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
export async function getSelectedCalendarId(): Promise<string> {
  return await getSettingAsync(SELECTED_CALENDAR_SETTING, '');
}

/**
 * Persist the user's preferred calendar ID.
 */
export async function setSelectedCalendarId(id: string): Promise<void> {
  await setSettingAsync(SELECTED_CALENDAR_SETTING, id);
}

/**
 * Check whether any calendar event starts within the next `windowMinutes` minutes.
 * Used to skip smart reminders when a meeting is imminent.
 */
export async function hasUpcomingEvent(windowMinutes: number): Promise<boolean> {
  const calendarEnabled = (await getSettingAsync('calendar_integration_enabled', '0')) === '1';
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
 * Delete all TouchGrass calendar events in the window [from, from + daysAhead days).
 * Used by scheduleDayReminders() to remove stale failsafe calendar events before
 * replacing them with freshly calculated ones.
 * Safe to call when calendar integration is disabled or no events exist.
 */
export async function deleteFutureTouchGrassEvents(from: Date, daysAhead: number): Promise<void> {
  const enabled = (await getSettingAsync('calendar_integration_enabled', '0')) === '1';
  if (!enabled) return;

  const calendarId = await getSettingAsync(TOUCHGRASS_CALENDAR_SETTING, '');
  if (!calendarId) return;

  const permissionGranted = await hasCalendarPermissions();
  if (!permissionGranted) return;

  try {
    const to = new Date(from.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const events = await Calendar.getEventsAsync([calendarId], from, to);
    for (const event of events) {
      try {
        await Calendar.deleteEventAsync(event.id);
      } catch {
        // Best-effort deletion — a missing event is not an error.
      }
    }
    if (events.length > 0) {
      console.log(
        `TouchGrass: Deleted ${events.length} stale planned calendar event(s) before fresh planning`
      );
    }
  } catch (e) {
    console.warn('TouchGrass: Failed to delete future TouchGrass events:', e);
  }
}

/**
 * Conditionally add an outdoor time slot to the calendar based on the user's
 * settings.  Does nothing when calendar integration is disabled or the default
 * duration is set to Off (0).  Safe to call fire-and-forget.
 */
export async function maybeAddOutdoorTimeToCalendar(startTime: Date): Promise<void> {
  const enabled = (await getSettingAsync('calendar_integration_enabled', '0')) === '1';
  if (!enabled) return;

  const duration = parseInt(await getSettingAsync('calendar_default_duration', '0'), 10);
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
  title?: string
): Promise<boolean> {
  const { granted } = await requestCalendarPermissions();
  if (!granted) {
    return false;
  }

  try {
    const touchGrassId = await getOrCreateTouchGrassCalendar();
    if (!touchGrassId) {
      console.warn('TouchGrass: Could not obtain TouchGrass calendar for writing');
      return false;
    }

    // Log calendar metadata so that "all stages failed" logs are always accompanied by
    // the calendar's actual state — this reveals whether allowsModifications/accessLevel
    // are the true root cause even when all payload variants are rejected.
    // Emitted as console.warn so it is visible in logcat W/ReactNativeJS filter.
    try {
      const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const tgCal = allCals.find((c) => c.id === touchGrassId);
      if (tgCal) {
        console.warn('TouchGrass: Calendar target', {
          id: tgCal.id,
          title: tgCal.title,
          allowsModifications: tgCal.allowsModifications,
          accessLevel: tgCal.accessLevel,
          sourceType: tgCal.source?.type,
          isLocalAccount: tgCal.source?.isLocalAccount,
          isSynced: (tgCal as unknown as { isSynced?: boolean }).isSynced,
          isVisible: (tgCal as unknown as { isVisible?: boolean }).isVisible,
        });
      } else {
        console.warn('TouchGrass: Calendar target not found in calendar list', { touchGrassId });
      }
    } catch {
      // Non-critical diagnostic — never block the write attempt
    }

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

    const ultraMinimalEventDetails = {
      title: eventTitle,
      startDate: startTime,
      endDate: endTime,
    };

    const fingerprint = eventFingerprint(eventTitle, startTime.getTime(), endTime.getTime());

    const createEventWithFallback = async (
      calendarId: string,
      calendarLabel: string
    ): Promise<void> => {
      const duplicate = await hasDuplicateEvent(calendarId, startTime, endTime, eventTitle);
      if (duplicate) {
        await logCalendarWriteDebug('duplicate event detected; skipping write', {
          calendarId,
          calendarLabel,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventTitle,
        });
        return;
      }

      // Stage 1: primary payload (with timeZone)
      await logCalendarWriteDebug('attempting primary event payload', {
        calendarId,
        calendarLabel,
        fingerprint,
        attempts: 0,
      });
      try {
        await Calendar.createEventAsync(calendarId, eventDetails);
        await logCalendarWriteDebug('event write succeeded', {
          calendarId,
          calendarLabel,
          payload: 'primary',
        });
        return;
      } catch (e1) {
        if (!isEventNotSavedError(e1)) throw e1;
        // E_EVENT_NOT_SAVED — continue to next stage
      }

      // Stage 2: fallback payload (no timeZone)
      console.warn(
        'TouchGrass: Primary event payload rejected (E_EVENT_NOT_SAVED); retrying without timeZone',
        { calendarId, calendarLabel }
      );
      try {
        await Calendar.createEventAsync(calendarId, fallbackEventDetails);
        await logCalendarWriteDebug('event write succeeded', {
          calendarId,
          calendarLabel,
          payload: 'fallback',
        });
        return;
      } catch (e2) {
        console.warn('TouchGrass: Fallback payload failed; retrying ultra-minimal payload', {
          calendarId,
          calendarLabel,
          errorCode: (e2 as { code?: string })?.code,
          errorMessage: (e2 as { message?: string })?.message,
        });
      }

      // Stage 3: ultra-minimal payload (title, startDate, endDate only — no allDay, no timeZone)
      try {
        await Calendar.createEventAsync(calendarId, ultraMinimalEventDetails);
        await logCalendarWriteDebug('event write succeeded', {
          calendarId,
          calendarLabel,
          payload: 'ultra-minimal',
        });
        return;
      } catch (e3) {
        console.warn('TouchGrass: Ultra-minimal payload failed; will recreate calendar and retry', {
          calendarId,
          calendarLabel,
          errorCode: (e3 as { code?: string })?.code,
          errorMessage: (e3 as { message?: string })?.message,
        });
      }

      // Stage 4: force-create a brand-new calendar and retry with all payload variants.
      // All three payload variants failed against the same calendar.  One known cause is
      // a signing-key mismatch: a calendar created by a different build (different UID) can
      // silently reject inserts from the new UID on some Android ROMs.  We also reach this
      // stage when the CalendarProvider has a broader restriction — the metadata logs above
      // will reveal which case we're in.  By passing forceCreate=true we always create a
      // genuinely new calendar owned by the current app UID; then we retry all payload
      // variants in case the fresh calendar accepts a different form.
      console.warn('TouchGrass: All payload variants rejected; force-creating a new calendar', {
        calendarId,
        calendarLabel,
      });
      await setSettingAsync(TOUCHGRASS_CALENDAR_SETTING, ''); // clear stale cached ID
      const freshCalendarId = await getOrCreateTouchGrassCalendar(true); // forceCreate: bypass any existing calendar
      if (!freshCalendarId) {
        throw new Error('TouchGrass: Could not recreate TouchGrass calendar for retry');
      }

      // Log fresh-calendar metadata so we can diagnose why writes still fail if they do.
      try {
        const freshCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const freshCal = freshCals.find((c) => c.id === freshCalendarId);
        if (freshCal) {
          console.warn('TouchGrass: Fresh calendar target (post-recreate)', {
            id: freshCal.id,
            title: freshCal.title,
            allowsModifications: freshCal.allowsModifications,
            accessLevel: freshCal.accessLevel,
            sourceType: freshCal.source?.type,
            isLocalAccount: freshCal.source?.isLocalAccount,
            isSynced: (freshCal as unknown as { isSynced?: boolean }).isSynced,
            isVisible: (freshCal as unknown as { isVisible?: boolean }).isVisible,
          });
        } else {
          console.warn('TouchGrass: Fresh calendar not found in calendar list after creation', {
            freshCalendarId,
          });
        }
      } catch {
        // Non-critical diagnostic — never block the write attempt
      }

      // Try all three payload variants on the fresh calendar (not just ultra-minimal),
      // since the fresh calendar is genuinely new and may accept a different payload form.
      let stage4Error: unknown;
      for (const [label, payload] of [
        ['primary', eventDetails],
        ['fallback', fallbackEventDetails],
        ['ultra-minimal', ultraMinimalEventDetails],
      ] as const) {
        try {
          await Calendar.createEventAsync(freshCalendarId, payload);
          await logCalendarWriteDebug('event write succeeded after calendar recreation', {
            calendarId: freshCalendarId,
            calendarLabel,
            payload: label,
          });
          return;
        } catch (err) {
          stage4Error = err;
          if (!isEventNotSavedError(err)) break; // non-recoverable error — stop trying
        }
      }
      console.warn('TouchGrass: All write stages exhausted', {
        calendarId: freshCalendarId,
        calendarLabel,
        errorCode: (stage4Error as { code?: string })?.code,
        errorMessage: (stage4Error as { message?: string })?.message,
        nativeDescription: (stage4Error as { nativeDescription?: string })?.nativeDescription,
        startDateMs: startTime.getTime(),
        endDateMs: endTime.getTime(),
        error: String(stage4Error),
      });
      throw stage4Error;
    };

    await createEventWithFallback(touchGrassId, TOUCHGRASS_CALENDAR_NAME);
    return true;
  } catch (e) {
    console.warn('TouchGrass: Failed to add event to calendar:', e);
    return false;
  }
}
