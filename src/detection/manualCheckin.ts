import { submitSession, buildSession } from './sessionMerger';
import { insertSessionAsync } from '../storage/database';
import { t } from '../i18n';

const CONFIDENCE_MANUAL = 1.0; // user always knows best

/**
 * Log a manual outside session.
 * @param durationMinutes - how long the session was
 * @param startTime - unix ms, defaults to now minus durationMinutes
 * @param endTime - unix ms, defaults to startTime + durationMinutes. Pass the
 *   exact stop timestamp so the stored times match what the user reviewed.
 * @param notes - optional notes text, defaults to the localised "Manual entry." string
 */
export function logManualSession(
  durationMinutes: number,
  startTime?: number,
  endTime?: number,
  notes?: string
): void {
  const start = startTime ?? Date.now() - durationMinutes * 60 * 1000;
  const end = endTime ?? start + durationMinutes * 60 * 1000;

  const session = buildSession(
    start,
    end,
    'manual',
    CONFIDENCE_MANUAL,
    notes ?? t('session_notes_manual')
  );

  // Manual sessions are auto-confirmed — the user knows what they logged
  session.userConfirmed = 1;

  submitSession(session);
}

/**
 * Async version of logManualSession for use in Headless JS contexts (e.g. widget).
 * Awaits the database insert so the JS thread can process GC before the task exits.
 * Manual sessions bypass the merge pipeline and are inserted directly.
 */
export async function logManualSessionAsync(
  durationMinutes: number,
  startTime?: number,
  endTime?: number
): Promise<void> {
  const start = startTime ?? Date.now() - durationMinutes * 60 * 1000;
  const end = endTime ?? start + durationMinutes * 60 * 1000;

  const session = buildSession(start, end, 'manual', CONFIDENCE_MANUAL, t('session_notes_manual'));

  // Manual sessions are auto-confirmed — the user knows what they logged
  session.userConfirmed = 1;

  await insertSessionAsync(session);
}

/**
 * Start a live manual session (user taps "I'm going outside now").
 * Returns a function to call when they return.
 */
export function startManualSession(): () => void {
  const startTime = Date.now();

  return function stopManualSession() {
    const endTime = Date.now();

    // Record all sessions, even very short ones (no minimum)
    const session = buildSession(
      startTime,
      endTime,
      'manual',
      CONFIDENCE_MANUAL,
      t('session_notes_manual')
    );

    submitSession(session);
  };
}
