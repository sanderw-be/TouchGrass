import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
  formatLocalDate: jest.fn(() => ''),
  formatLocalTime: jest.fn(() => ''),
}));

// Mock App Store
jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      colors: {
        grass: '#4A7C59',
        grassLight: '#6BAF7A',
        grassPale: '#E8F5EC',
        grassDark: '#2D5240',
        sky: '#7EB8D4',
        skyLight: '#B8DFF0',
        sun: '#F5C842',
        mist: '#F8F9F7',
        fog: '#E8EBE6',
        card: '#FFFFFF',
        textPrimary: '#1A2E1F',
        textSecondary: '#5A7060',
        textMuted: '#8FA892',
        textInverse: '#FFFFFF',
      },
      shadows: {
        soft: {
          shadowColor: '#2D5240',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        medium: {
          shadowColor: '#2D5240',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        },
      },
      isDark: false,
    })
  ),
}));

const mockGetCurrentDailyGoal = jest.fn(
  () =>
    new Promise<{ targetMinutes: number }>((r) => setTimeout(() => r({ targetMinutes: 30 }), 50))
);
const mockGetSettingAsync = jest.fn<Promise<string>, [string, string]>((key: string, def: string) =>
  Promise.resolve(def)
);

jest.mock('../storage/database', () => ({
  getSettingAsync: (key: string, def: string) => mockGetSettingAsync(key, def),
  setSettingAsync: jest.fn(() => Promise.resolve()),
  getCurrentDailyGoalAsync: () => mockGetCurrentDailyGoal(),
  getCurrentWeeklyGoalAsync: jest.fn(() => Promise.resolve({ targetMinutes: 150 })),
  setDailyGoalAsync: jest.fn(() => Promise.resolve()),
  setWeeklyGoalAsync: jest.fn(() => Promise.resolve()),
  getSelectedCalendarId: jest.fn(() => ''),
}));

jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  hasCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  getSelectedCalendarId: jest.fn(() => ''),
  setSelectedCalendarId: jest.fn(),
  getWritableCalendars: jest.fn(() => Promise.resolve([])),
  getOrCreateTouchGrassCalendar: jest.fn(() => Promise.resolve('local-tg-id')),
}));

jest.mock('../detection', () => ({
  checkWeatherLocationPermissions: jest.fn(() => Promise.resolve(false)),
  requestWeatherLocationPermissions: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../utils/batteryOptimization', () => ({
  BATTERY_OPTIMIZATION_SETTING_KEY: 'battery_optimization_granted',
  openBatteryOptimizationSettings: jest.fn(() => Promise.resolve(true)),
  refreshBatteryOptimizationSetting: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, []);
  },
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import GoalsScreen from '../screens/GoalsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('GoalsScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<GoalsScreen />);
    await act(async () => {
      await delay(150);
    });
    expect(mockGetCurrentDailyGoal).toHaveBeenCalledTimes(1);
  });
});
