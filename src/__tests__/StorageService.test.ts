import { StorageService } from '../storage/StorageService';

describe('StorageService', () => {
  let mockDb: any;
  let service: StorageService;

  beforeEach(() => {
    mockDb = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
    };
    service = new StorageService(mockDb);
  });

  describe('getCurrentDailyGoalAsync', () => {
    it('queries the latest goal from daily_goals using createdAt', async () => {
      const mockGoal = { id: 1, targetMinutes: 30, createdAt: Date.now() };
      mockDb.getFirstAsync.mockResolvedValue(mockGoal);

      const result = await service.getCurrentDailyGoalAsync();

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM daily_goals ORDER BY createdAt DESC LIMIT 1'
      );
      expect(result).toEqual(mockGoal);
    });
  });

  describe('insertBackgroundLogAsync', () => {
    it('uses background_task_logs table and category column', async () => {
      await service.insertBackgroundLogAsync('gps', 'test message');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO background_task_logs (timestamp, category, message) VALUES (?, ?, ?)',
        [expect.any(Number), 'gps', 'test message']
      );
    });
  });
});
