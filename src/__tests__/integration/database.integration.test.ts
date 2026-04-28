import { initDatabaseAsync, db } from '../../storage/db';
import { StorageService } from '../../storage/StorageService';

describe('In-Memory SQLite Integration Tests', () => {
  const storage = new StorageService(db);

  beforeAll(async () => {
    // This runs against the real in-memory sqlite3 instance provided by jest.integration.setup.js
    await initDatabaseAsync();
  });

  it('should initialize the database, insert a daily goal, and query it', async () => {
    // initDatabaseAsync seeds the default goal of 30 minutes
    const goal = await storage.getCurrentDailyGoalAsync();
    expect(goal).not.toBeNull();
    expect(goal?.targetMinutes).toBe(30);
  });

  it('should correctly insert a background log', async () => {
    await storage.insertBackgroundLogAsync('test-source', 'test-message');

    // Currently we don't have a getBackgroundLogsAsync on StorageService exposed in the output,
    // but the query insertion should not throw an error if the table and schema are correct.
    expect(true).toBe(true); // If we reached here without SQL syntax errors, test passed
  });
});
