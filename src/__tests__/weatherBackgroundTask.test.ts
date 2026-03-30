/**
 * The old weatherBackgroundTask.ts has been deleted.
 * Weather refresh is now handled inside the unified background task.
 * Tests for the unified task (including weather handling) live in backgroundService.test.ts.
 */

describe('weatherBackgroundTask (legacy — deleted)', () => {
  it('has been merged into unifiedBackgroundTask', () => {
    // The separate weather background task has been removed.
    // See src/background/unifiedBackgroundTask.ts and backgroundService.test.ts.
    expect(true).toBe(true);
  });
});
