import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
  formatLocalDate: jest.fn(() => ''),
  formatLocalTime: jest.fn(() => ''),
  getDeviceSupportedLocale: jest.fn(() => 'en'),
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
        error: '#ff0000',
        inactive: '#cccccc',
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
      locale: 'en',
      setLocale: jest.fn(),
      handleShowIntro: jest.fn(),
      themePreference: 'system',
      setThemePreference: jest.fn(),
    })
  ),
}));

const mockGetKnownLocations = jest.fn(
  () => new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);

jest.mock('../storage/database', () => ({
  getKnownLocationsAsync: () => mockGetKnownLocations(),
  getSuggestedLocationsAsync: jest.fn(() => Promise.resolve([])),
  clearAllDataAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
  getBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
}));

jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() =>
    Promise.resolve({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    })
  ),
  toggleHealthConnect: jest.fn(() => Promise.resolve({ needsPermissions: false })),
  toggleGPS: jest.fn(() => Promise.resolve({ needsPermissions: false })),
  recheckHealthConnect: jest.fn(() => Promise.resolve()),
  checkGPSPermissions: jest.fn(() => Promise.resolve()),
  requestGPSPermissions: jest.fn(() => Promise.resolve(false)),
  requestHealthConnect: jest.fn(() => Promise.resolve(true)),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, []);
    },
    useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.0' },
  },
}));

import SettingsScreen from '../screens/SettingsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('SettingsScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<SettingsScreen />);
    await act(async () => {
      await delay(150);
    });
    expect(mockGetKnownLocations).toHaveBeenCalledTimes(1);
  });
});
