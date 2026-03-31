/**
 * Lightweight pub/sub for "session data changed" notifications.
 *
 * Background work (Health Connect sync, GPS detection) calls
 * emitSessionsChanged() after inserting or updating sessions.
 * UI screens subscribe with onSessionsChanged() and call loadData()
 * so the user sees fresh data without having to navigate away and back.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Notify all subscribers that session data may have changed.
 * Safe to call from any async context.
 */
export function emitSessionsChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('TouchGrass: sessionsChanged listener error:', e);
    }
  }
}

/**
 * Subscribe to session-data-changed notifications.
 * Returns an unsubscribe function — call it inside a useEffect cleanup.
 *
 * @example
 * useEffect(() => onSessionsChanged(loadData), [loadData]);
 */
export function onSessionsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
