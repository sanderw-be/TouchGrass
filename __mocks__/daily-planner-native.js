// Mock for modules/daily-planner-native
module.exports = {
  scheduleDailyPlanner: jest.fn(() => Promise.resolve()),
  cancelDailyPlanner: jest.fn(() => Promise.resolve()),
  scheduleExactAlarm: jest.fn(() => Promise.resolve(true)),
  cancelExactAlarm: jest.fn(() => Promise.resolve()),
  isBatteryOptimizationIgnored: jest.fn(() => false),
  requestIgnoreBatteryOptimizations: jest.fn(),
  HEADLESS_TASK_NAME: 'DailyPlannerTask',
};
