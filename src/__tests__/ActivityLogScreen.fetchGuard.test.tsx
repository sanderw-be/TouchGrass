import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetBackgroundLogs = jest.fn(
  (_category: string) => new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);

jest.mock('../storage/database', () => ({
  getBackgroundLogsAsync: (category: string) => mockGetBackgroundLogs(category),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, []);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      setOptions: jest.fn(),
    }),
  };
});

import ActivityLogScreen from '../screens/ActivityLogScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('ActivityLogScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 3 times on initial mount', async () => {
    render(<ActivityLogScreen />);
    await act(async () => {
      await delay(150);
    });
    // loadLogs calls getBackgroundLogsAsync 3 times in a Promise.all
    // ('health_connect', 'gps', 'reminder')
    expect(mockGetBackgroundLogs).toHaveBeenCalledTimes(3);
  });
});
