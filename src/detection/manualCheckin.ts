import { submitSession, buildSession } from './sessionMerger';
import { t } from '../i18n';

const CONFIDENCE_MANUAL = 1.0; // user always knows best

/**
 * Log a manual outside session.
 * @param durationMinutes - how long the session was
 * @param startTime - unix ms, defaults to now minus durationMinutes
 * @param endTime - unix ms, defaults to startTime + durationMinutes. Pass the
 *   exact stop timestamp so the stored times match what the user reviewed.
 */
export function logManualSession(durationMinutes: number, startTime?: number, endTime?: number): void {
  const start = startTime ?? Date.now() - durationMinutes * 60 * 1000;
  const end = endTime ?? start + durationMinutes * 60 * 1000;

  const session = buildSession(
    start,
    end,
    'manual',
    CONFIDENCE_MANUAL,
    t('session_notes_manual'),
  );

  // Manual sessions are auto-confirmed — the user knows what they logged
  session.userConfirmed = 1;

  submitSession(session);
}

/**
 * Start a live manual session (user taps "I'm going outside now").
 * Returns a function to call when they return.
 */
export function startManualSession(): () => void {
  const startTime = Date.now();

  return function stopManualSession() {
    const endTime = Date.now();
    const durationMinutes = (endTime - startTime) / 60000;

    // Record all sessions, even very short ones (no minimum)
    const session = buildSession(
      startTime,
      endTime,
      'manual',
      CONFIDENCE_MANUAL,
      t('session_notes_manual'),
    );

    submitSession(session);
  };
}
