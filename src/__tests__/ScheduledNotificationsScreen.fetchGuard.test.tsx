import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      grass: '#4A7C59', grassLight: '#6BAF7A', grassPale: '#E8F5EC', grassDark: '#2D5240',
      sky: '#7EB8D4', skyLight: '#B8DFF0', sun: '#F5C842', mist: '#F8F9F7',
      fog: '#E8EBE6', card: '#FFFFFF', textPrimary: '#1A2E1F', textSecondary: '#5A7060',
      textMuted: '#8FA892', textInverse: '#FFFFFF',
    },
    shadows: {
      soft: { shadowColor: '#2D5240', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
      medium: { shadowColor: '#2D5240', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
    },
    isDark: false,
  }),
}));

const mockGetScheduledNotifications = jest.fn(() =>
  new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);

jest.mock('../storage/database', () => ({
  getScheduledNotificationsAsync: (...args: unknown[]) => mockGetScheduledNotifications(...args),
  insertScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  updateScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  deleteScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  toggleScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../notifications/scheduledNotifications', () => ({
  scheduleAllScheduledNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/helpers', () => ({
  uses24HourClock: jest.fn(() => true),
  normalizeAmPm: jest.fn((s: string) => s),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => { cb(); }, []);
    },
  };
});

import ScheduledNotificationsScreen from '../screens/ScheduledNotificationsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('ScheduledNotificationsScreen fetch guard', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<ScheduledNotificationsScreen />);
    await act(async () => { await delay(150); });
    expect(mockGetScheduledNotifications).toHaveBeenCalledTimes(1);
  });
});
