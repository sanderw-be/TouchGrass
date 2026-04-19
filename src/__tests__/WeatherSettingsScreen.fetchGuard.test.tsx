import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

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
    })
  ),
}));

const mockGetSetting = jest.fn(
  (key: string, def: string) => new Promise<string>((r) => setTimeout(() => r(def), 50))
);

jest.mock('../storage', () => ({
  getSettingAsync: (key: string, def: string) => mockGetSetting(key, def),
  setSettingAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, []);
  },
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: jest.fn(() => Promise.resolve({ success: true })),
  isWeatherDataAvailable: jest.fn(() => true),
  getWeatherForHour: jest.fn(() => null),
}));

jest.mock('../weather/weatherAlgorithm', () => ({
  getWeatherDescription: jest.fn(() => 'Clear sky'),
  getWeatherEmoji: jest.fn(() => '☀️'),
}));

jest.mock('../utils/temperature', () => ({
  formatTemperature: jest.fn((temp: number) => `${temp}°`),
}));

import WeatherSettingsScreen from '../screens/WeatherSettingsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('WeatherSettingsScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 4 times on initial mount', async () => {
    render(<WeatherSettingsScreen />);
    await act(async () => {
      await delay(500);
    });
    // loadSettings calls getSettingAsync 4 times:
    // 'temp_preference', 'weather_avoid_rain', 'weather_avoid_heat', 'weather_consider_uv'
    expect(mockGetSetting).toHaveBeenCalledTimes(4);
  });
});
