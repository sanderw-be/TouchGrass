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

  describe('KnownLocations', () => {
    const mockLocations = [
      {
        id: 1,
        label: 'Home',
        latitude: 52,
        longitude: 5,
        radiusMeters: 100,
        isIndoor: 1,
        status: 'active',
      },
      {
        id: 2,
        label: 'Work',
        latitude: 51,
        longitude: 4,
        radiusMeters: 200,
        isIndoor: 0,
        status: 'active',
      },
      {
        id: 3,
        label: 'Suggested',
        latitude: 50,
        longitude: 3,
        radiusMeters: 50,
        isIndoor: 1,
        status: 'suggested',
      },
    ];

    it('getAllKnownLocationsAsync should return all mapped locations', async () => {
      mockDb.getAllAsync.mockResolvedValue(mockLocations);
      const result = await service.getAllKnownLocationsAsync();

      expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM known_locations');
      expect(result).toHaveLength(3);
      expect(result[0].isIndoor).toBe(true);
      expect(result[1].isIndoor).toBe(false);
      expect(result[2].status).toBe('suggested');
    });

    it('getKnownLocationsAsync should return only active mapped locations', async () => {
      mockDb.getAllAsync.mockResolvedValue(mockLocations.filter((l) => l.status === 'active'));
      const result = await service.getKnownLocationsAsync();

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM known_locations WHERE status = ?',
        ['active']
      );
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.status === 'active')).toBe(true);
    });
  });
});
