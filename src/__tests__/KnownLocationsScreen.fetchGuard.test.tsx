import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
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
  }),
}));

const mockGetAllKnownLocations = jest.fn(
  () => new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);

jest.mock('../storage/database', () => ({
  getAllKnownLocationsAsync: () => mockGetAllKnownLocations(),
  getSettingAsync: jest.fn((key: string, def: string) => Promise.resolve(def)),
  setSettingAsync: jest.fn(() => Promise.resolve()),
  denyKnownLocationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() => ({
    healthConnect: false,
    healthConnectPermission: false,
    gps: false,
    gpsPermission: false,
  })),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 0, longitude: 0 } })
  ),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([])),
  Accuracy: { Balanced: 3 },
}));

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, []);
    },
    useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../components/EditLocationSheet', () => {
  return jest.fn(() => null);
});

import KnownLocationsScreen from '../screens/KnownLocationsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('KnownLocationsScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<KnownLocationsScreen />);
    await act(async () => {
      await delay(150);
    });
    expect(mockGetAllKnownLocations).toHaveBeenCalledTimes(1);
  });
});
