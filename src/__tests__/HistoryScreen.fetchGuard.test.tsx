import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Jan 1',
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${Math.round(mins)}m`,
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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, []);
  },
}));

const mockGetSessionsForRange = jest.fn(
  (_from: number, _to: number) => new Promise<never[]>((r) => setTimeout(() => r([]), 10))
);
const mockGetDailyTotalsForMonth = jest.fn(
  (_date: number) => new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);
const mockGetCurrentDailyGoal = jest.fn(
  () =>
    new Promise<{ targetMinutes: number }>((r) => setTimeout(() => r({ targetMinutes: 30 }), 50))
);

jest.mock('../storage/database', () => ({
  startOfDay: jest.fn((ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }),
  startOfWeek: jest.fn((date: number) => date),
  getSessionsForRangeAsync: (from: number, to: number) => mockGetSessionsForRange(from, to),
  getDailyTotalsForMonthAsync: (date: number) => mockGetDailyTotalsForMonth(date),
  getCurrentDailyGoalAsync: () => mockGetCurrentDailyGoal(),
}));

import HistoryScreen from '../screens/HistoryScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('HistoryScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<HistoryScreen />);
    await act(async () => {
      await delay(500);
    });
    expect(mockGetCurrentDailyGoal).toHaveBeenCalledTimes(1);
    // In week mode (default), getSessionsForRangeAsync is called once for the full 7-day range
    expect(mockGetSessionsForRange).toHaveBeenCalledTimes(1);
  });
});
