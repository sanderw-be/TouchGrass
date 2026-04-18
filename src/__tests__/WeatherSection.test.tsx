import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      colors: {
        mist: '#f5f5f5',
        card: '#ffffff',
        grass: '#4caf50',
        grassLight: '#81c784',
        grassDark: '#2e7d32',
        grassPale: '#e8f5e9',
        fog: '#e0e0e0',
        textPrimary: '#212121',
        textSecondary: '#757575',
        textMuted: '#9e9e9e',
        textInverse: '#ffffff',
        inactive: '#bdbdbd',
        error: '#f44336',
      },
      shadows: { soft: {} },
    })
  ),
}));

import WeatherSection from '../components/goals/WeatherSection';

const defaultProps = {
  weatherEnabled: false,
  weatherLocationGranted: false,
  onToggleWeather: jest.fn(),
  onShowWeatherPermissionSheet: jest.fn(),
  onNavigateWeatherSettings: jest.fn(),
};

describe('WeatherSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<WeatherSection {...defaultProps} />);
    expect(getByText('settings_weather_title')).toBeTruthy();
  });

  it('renders the weather enabled toggle row', () => {
    const { getByText } = render(<WeatherSection {...defaultProps} />);
    expect(getByText('settings_weather_enabled')).toBeTruthy();
  });

  it('does not show the weather settings link when weather is disabled', () => {
    const { queryByText } = render(
      <WeatherSection {...defaultProps} weatherEnabled={false} weatherLocationGranted={true} />
    );
    expect(queryByText('settings_weather_more')).toBeNull();
  });

  it('does not show the weather settings link when permission is not granted', () => {
    const { queryByText } = render(
      <WeatherSection {...defaultProps} weatherEnabled={true} weatherLocationGranted={false} />
    );
    expect(queryByText('settings_weather_more')).toBeNull();
  });

  it('shows the weather settings link when weather is enabled and permission is granted', () => {
    const { getByText } = render(
      <WeatherSection {...defaultProps} weatherEnabled={true} weatherLocationGranted={true} />
    );
    expect(getByText('settings_weather_more')).toBeTruthy();
  });

  it('shows permission missing label when weather is enabled but permission is not granted', () => {
    const { getByText } = render(
      <WeatherSection {...defaultProps} weatherEnabled={true} weatherLocationGranted={false} />
    );
    expect(getByText('settings_weather_permission_missing')).toBeTruthy();
  });

  it('calls onNavigateWeatherSettings when weather settings link is tapped', () => {
    const onNavigateWeatherSettings = jest.fn();
    const { getByText } = render(
      <WeatherSection
        {...defaultProps}
        weatherEnabled={true}
        weatherLocationGranted={true}
        onNavigateWeatherSettings={onNavigateWeatherSettings}
      />
    );
    fireEvent.press(getByText('settings_weather_more'));
    expect(onNavigateWeatherSettings).toHaveBeenCalled();
  });

  it('calls onShowWeatherPermissionSheet when permission missing label is tapped', () => {
    const onShowWeatherPermissionSheet = jest.fn();
    const { getByText } = render(
      <WeatherSection
        {...defaultProps}
        weatherEnabled={true}
        weatherLocationGranted={false}
        onShowWeatherPermissionSheet={onShowWeatherPermissionSheet}
      />
    );
    fireEvent.press(getByText('settings_weather_permission_missing'));
    expect(onShowWeatherPermissionSheet).toHaveBeenCalled();
  });
});
