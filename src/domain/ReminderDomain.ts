export const SMART_REMINDERS_OPTIONS = [0, 1, 2, 3];
export const CALENDAR_BUFFER_OPTIONS = [10, 20, 30, 45, 60];
export const CALENDAR_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30];

/**
 * Checks if a feature is enabled but its required permission is missing.
 */
export function isPermissionIssue(enabled: boolean, permissionGranted: boolean): boolean {
  return enabled && !permissionGranted;
}

/**
 * Returns a list of feature labels that have permission issues.
 */
export function getPermissionIssueLabels(
  smartRemindersCount: number,
  notificationPermissionGranted: boolean,
  weatherEnabled: boolean,
  weatherLocationGranted: boolean,
  calendarEnabled: boolean,
  calendarPermissionGranted: boolean,
  labels: { reminders: string; weather: string; calendar: string }
): string[] {
  const issues: string[] = [];
  if (smartRemindersCount > 0 && !notificationPermissionGranted) {
    issues.push(labels.reminders);
  }
  if (weatherEnabled && !weatherLocationGranted) {
    issues.push(labels.weather);
  }
  if (calendarEnabled && !calendarPermissionGranted) {
    issues.push(labels.calendar);
  }
  return issues;
}
