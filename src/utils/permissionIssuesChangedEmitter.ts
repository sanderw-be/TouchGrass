/**
 * Lightweight pub/sub for "permission issue state changed" notifications.
 *
 * GoalsScreen and SettingsScreen call emitPermissionIssuesChanged() whenever
 * a feature is enabled or disabled (toggle or permission-sheet disable button).
 * AppNavigator subscribes and calls refreshPermissionBadges() so the tab
 * badge counts update immediately without waiting for an app-foreground event.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Notify all subscribers that the permission-issues state may have changed.
 * Safe to call from any async context.
 */
export function emitPermissionIssuesChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('TouchGrass: permissionIssuesChanged listener error:', e);
    }
  }
}

/**
 * Subscribe to permission-issues-changed notifications.
 * Returns an unsubscribe function — call it inside a useEffect cleanup.
 *
 * @example
 * useEffect(() => onPermissionIssuesChanged(refreshPermissionBadges), [refreshPermissionBadges]);
 */
export function onPermissionIssuesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
