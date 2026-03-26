import { Platform } from 'react-native';

const mockModule = require('../../modules/daily-planner-native');

describe('daily-planner-native module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleDailyPlanner', () => {
    it('calls the native module on Android', async () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      const { scheduleDailyPlanner } = mockModule;
      await scheduleDailyPlanner();

      expect(scheduleDailyPlanner).toHaveBeenCalledTimes(1);

      (Platform as any).OS = originalOS;
    });
  });

  describe('cancelDailyPlanner', () => {
    it('calls the native module cancel', async () => {
      const { cancelDailyPlanner } = mockModule;
      await cancelDailyPlanner();

      expect(cancelDailyPlanner).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleExactAlarm', () => {
    it('calls the native module with correct parameters', async () => {
      const { scheduleExactAlarm } = mockModule;
      const result = await scheduleExactAlarm(42, 14, 30);

      expect(scheduleExactAlarm).toHaveBeenCalledWith(42, 14, 30);
      expect(result).toBe(true);
    });
  });

  describe('cancelExactAlarm', () => {
    it('calls the native module with the alarm ID', async () => {
      const { cancelExactAlarm } = mockModule;
      await cancelExactAlarm(42);

      expect(cancelExactAlarm).toHaveBeenCalledWith(42);
    });
  });

  describe('isBatteryOptimizationIgnored', () => {
    it('returns false by default (mock)', () => {
      const { isBatteryOptimizationIgnored } = mockModule;
      expect(isBatteryOptimizationIgnored()).toBe(false);
    });

    it('returns true when battery optimization is ignored', () => {
      const { isBatteryOptimizationIgnored } = mockModule;
      (isBatteryOptimizationIgnored as jest.Mock).mockReturnValueOnce(true);
      expect(isBatteryOptimizationIgnored()).toBe(true);
    });
  });

  describe('requestIgnoreBatteryOptimizations', () => {
    it('calls the native module', () => {
      const { requestIgnoreBatteryOptimizations } = mockModule;
      requestIgnoreBatteryOptimizations();

      expect(requestIgnoreBatteryOptimizations).toHaveBeenCalledTimes(1);
    });
  });

  describe('HEADLESS_TASK_NAME', () => {
    it('exports the expected task name', () => {
      const { HEADLESS_TASK_NAME } = mockModule;
      expect(HEADLESS_TASK_NAME).toBe('DailyPlannerTask');
    });
  });
});
