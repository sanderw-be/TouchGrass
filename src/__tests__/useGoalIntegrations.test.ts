import { renderHook, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useGoalIntegrations } from '../hooks/useGoalIntegrations';
import { getSettingAsync, setSettingAsync } from '../storage/database';

// Mock dependencies
jest.mock('../storage/database', () => ({
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
}));
jest.mock('../calendar/calendarService', () => ({
  hasCalendarPermissions: jest.fn(),
  getWritableCalendars: jest.fn().mockResolvedValue([]),
  getSelectedCalendarId: jest.fn().mockResolvedValue(''),
  setSelectedCalendarId: jest.fn(),
  requestCalendarPermissions: jest.fn(),
}));
jest.mock('../detection', () => ({
  checkWeatherLocationPermissions: jest.fn(),
  requestWeatherLocationPermissions: jest.fn(),
}));
jest.mock('../utils/batteryOptimization', () => ({
  BATTERY_OPTIMIZATION_SETTING_KEY: 'battery_optimization_enabled',
  refreshBatteryOptimizationSetting: jest.fn(),
  openBatteryOptimizationSettings: jest.fn(),
}));
jest.mock('../notifications/notificationManager', () => ({
  NotificationService: {
    requestNotificationPermissions: jest.fn(),
  },
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('../utils/permissionIssuesChangedEmitter', () => ({
  emitPermissionIssuesChanged: jest.fn(),
}));

// Mock t to return keys for easier testing
jest.mock('../i18n', () => ({
  t: jest.fn((key) => key),
}));

// Mock useFocusEffect to do nothing
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

describe('useGoalIntegrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSettingAsync as jest.Mock).mockImplementation((key, def) => Promise.resolve(def));
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  });

  it('initializes and loads settings', async () => {
    (getSettingAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'smart_reminders_count') return Promise.resolve('3');
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve('0');
    });

    const { result } = renderHook(() => useGoalIntegrations());

    await act(async () => {
      await result.current.loadIntegrationSettings();
    });

    expect(result.current.smartRemindersCount).toBe(3);
    expect(result.current.weatherEnabled).toBe(false);
  });

  it('cycles smart reminders count', async () => {
    (setSettingAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => useGoalIntegrations());

    // Should start at 2 (default)
    await act(async () => {
      await result.current.cycleSmartRemindersCount(); // 2 -> 3
    });
    expect(result.current.smartRemindersCount).toBe(3);

    await act(async () => {
      await result.current.cycleSmartRemindersCount(); // 3 -> 0
    });
    expect(result.current.smartRemindersCount).toBe(0);
  });
});
