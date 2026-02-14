import { submitSession, buildSession } from './sessionMerger';

const CONFIDENCE_MANUAL = 1.0; // user always knows best

/**
 * Log a manual outside session.
 * @param startTime - unix ms, defaults to now minus durationMinutes
 * @param durationMinutes - how long the session was
 */
export function logManualSession(durationMinutes: number, startTime?: number): void {
  const end = Date.now();
  const start = startTime ?? end - durationMinutes * 60 * 1000;

  const session = buildSession(
    start,
    end,
    'manual',
    CONFIDENCE_MANUAL,
    'Manually logged',
  );

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

    if (durationMinutes < 1) return; // ignore accidental taps

    const session = buildSession(
      startTime,
      endTime,
      'manual',
      CONFIDENCE_MANUAL,
      'Live manual session',
    );

    submitSession(session);
  };
}
