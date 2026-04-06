import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
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

const mockGetAllSessions = jest.fn(() =>
  new Promise<never[]>((r) => setTimeout(() => r([]), 50))
);
const mockAutoClose = jest.fn(() =>
  new Promise<number>((r) => setTimeout(() => r(0), 50))
);

jest.mock('../storage/database', () => ({
  getAllSessionsIncludingDiscardedAsync: (...args: unknown[]) => mockGetAllSessions(...args),
  autoCloseOldProposedSessionsAsync: (...args: unknown[]) => mockAutoClose(...args),
  confirmSessionAsync: jest.fn(() => Promise.resolve()),
  deleteSessionAsync: jest.fn(() => Promise.resolve()),
  unDiscardSessionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/sessionsChangedEmitter', () => ({
  onSessionsChanged: jest.fn(() => () => {}),
  emitSessionsChanged: jest.fn(),
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${mins} min`,
}));

jest.mock('../detection/sessionConfidence', () => ({
  updateTimeSlotProbability: jest.fn(),
}));

jest.mock('../notifications/notificationManager', () => ({
  cancelRemindersIfGoalReached: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/widgetHelper', () => ({
  requestWidgetRefresh: jest.fn(() => Promise.resolve()),
}));

jest.mock('../components/ManualSessionSheet', () => {
  return jest.fn(() => null);
});

jest.mock('../components/EditSessionSheet', () => {
  return jest.fn(() => null);
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => { cb(); }, []);
  },
}));

import EventsScreen from '../screens/EventsScreen';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('EventsScreen fetch guard', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<EventsScreen />);
    await act(async () => { await delay(150); });
    expect(mockGetAllSessions).toHaveBeenCalledTimes(1);
  });
});
