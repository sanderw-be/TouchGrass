import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Mock database
jest.mock('../storage/database', () => ({
  getSetting: jest.fn((key: string, def: string) => def),
  setSetting: jest.fn(),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: jest.fn(),
  };
});

// Mock weather service
const mockFetchWeatherForecast = jest.fn();
const mockIsWeatherDataAvailable = jest.fn(() => true);
const mockGetWeatherForHour = jest.fn(() => null);
jest.mock('../weather/weatherService', () => ({
  fetchWeatherForecast: () => mockFetchWeatherForecast(),
  isWeatherDataAvailable: () => mockIsWeatherDataAvailable(),
  getWeatherForHour: (_hour: number) => mockGetWeatherForHour(),
}));

// Mock weather algorithm
jest.mock('../weather/weatherAlgorithm', () => ({
  getWeatherDescription: jest.fn(() => 'Clear sky'),
  getWeatherEmoji: jest.fn(() => '☀️'),
}));

import WeatherSettingsScreen from '../screens/WeatherSettingsScreen';

describe('WeatherSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsWeatherDataAvailable.mockReturnValue(true);
    mockGetWeatherForHour.mockReturnValue(null);
    mockFetchWeatherForecast.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the refresh button initially', () => {
    const { getByText } = render(<WeatherSettingsScreen />);
    expect(getByText('settings_weather_refresh')).toBeTruthy();
  });

  it('shows checkmark after successful refresh and hides it after 2 seconds', async () => {
    const { getByText, queryByText } = render(<WeatherSettingsScreen />);

    const refreshBtn = getByText('settings_weather_refresh');

    await act(async () => {
      fireEvent.press(refreshBtn);
    });

    // After successful refresh, checkmark should be visible and refresh button hidden
    expect(queryByText('✓')).toBeTruthy();
    expect(queryByText('settings_weather_refresh')).toBeNull();

    // After 2 seconds, checkmark should disappear and refresh button returns
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(queryByText('✓')).toBeNull();
    expect(getByText('settings_weather_refresh')).toBeTruthy();
  });

  it('shows refresh button again after failed refresh (no checkmark)', async () => {
    mockFetchWeatherForecast.mockResolvedValue({ success: false, error: 'Network error' });
    const { getByText, queryByText } = render(<WeatherSettingsScreen />);

    const refreshBtn = getByText('settings_weather_refresh');

    await act(async () => {
      fireEvent.press(refreshBtn);
    });

    // On failure, no checkmark should appear
    expect(queryByText('✓')).toBeNull();
    expect(getByText('settings_weather_refresh')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const component = render(<WeatherSettingsScreen />);
    expect(component).toBeTruthy();
  });
});
