export const DAILY_PRESETS = [15, 20, 30, 45, 60, 90];
export const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300];

export const MIN_DAILY_MINUTES = 1;
export const MAX_DAILY_MINUTES = 720; // 12 hours

export const MIN_WEEKLY_MINUTES = 1;
export const MAX_WEEKLY_MINUTES = 5040; // 7 days * 12 hours

/**
 * Validate a daily goal target in minutes.
 */
export function validateDailyGoal(minutes: number): boolean {
  return !isNaN(minutes) && minutes >= MIN_DAILY_MINUTES && minutes <= MAX_DAILY_MINUTES;
}

/**
 * Validate a weekly goal target in minutes.
 */
export function validateWeeklyGoal(minutes: number): boolean {
  return !isNaN(minutes) && minutes >= MIN_WEEKLY_MINUTES && minutes <= MAX_WEEKLY_MINUTES;
}
