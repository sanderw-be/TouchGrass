module.exports = {
  HEADLESS_TASK_NAME: 'DailyPlannerTask',
  scheduleDailyPlanner: jest.fn(() => Promise.resolve()),
  cancelDailyPlanner: jest.fn(() => Promise.resolve()),
  scheduleExactAlarm: jest.fn(() => Promise.resolve()),
  requestIgnoreBatteryOptimizations: jest.fn(() => Promise.resolve(false)),
};
