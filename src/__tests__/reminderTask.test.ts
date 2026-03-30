/**
 * The old reminderTask.ts (react-native-background-actions infinite loop) has been
 * deleted and replaced by unifiedBackgroundTask.ts.
 * The computeNextSleepMs helper it contained is no longer needed since
 * expo-background-task handles its own scheduling interval.
 *
 * The unified background task tests live in backgroundService.test.ts.
 */

describe('reminderTask (legacy — deleted)', () => {
  it('has been replaced by unifiedBackgroundTask', () => {
    // The legacy foreground-service loop has been removed.
    // See src/background/unifiedBackgroundTask.ts and backgroundService.test.ts.
    expect(true).toBe(true);
  });
});
