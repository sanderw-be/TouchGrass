import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Monday, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${mins}m`,
  formatTime: () => '10:00',
  formatTimer: (secs: number) => `00:${String(secs).padStart(2, '0')}`,
}));

const mockGetTodayMinutes = jest.fn(() => 20);
const mockGetWeekMinutes = jest.fn(() => 100);
const mockGetCurrentDailyGoal = jest.fn(() => ({ targetMinutes: 60 }));
const mockGetCurrentWeeklyGoal = jest.fn(() => ({ targetMinutes: 300 }));
const mockGetSessionsForDay = jest.fn(() => []);
const mockConfirmSession = jest.fn();

jest.mock('../storage/database', () => ({
  getTodayMinutes: () => mockGetTodayMinutes(),
  getWeekMinutes: () => mockGetWeekMinutes(),
  getCurrentDailyGoal: () => mockGetCurrentDailyGoal(),
  getCurrentWeeklyGoal: () => mockGetCurrentWeeklyGoal(),
  getSessionsForDay: () => mockGetSessionsForDay(),
  confirmSession: (...args: any[]) => mockConfirmSession(...args),
}));

const mockStopFn = jest.fn();
const mockStartManualSession = jest.fn(() => mockStopFn);

jest.mock('../detection/manualCheckin', () => ({
  startManualSession: () => mockStartManualSession(),
}));

jest.mock('../detection/sessionConfidence', () => ({
  updateTimeSlotProbability: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, []);
  },
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

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
    isDark: false,
  }),
}));

// Silence SVG rendering in tests
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: any) => <View>{children}</View>,
    Circle: () => null,
    Animated: { Circle: () => null },
  };
});

import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen inline timer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the progress ring with start hint when timer is idle', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('ring_timer_start')).toBeTruthy();
  });

  it('starts the timer when the ring centre is pressed', () => {
    const { getByText, getByTestId, queryByTestId } = render(<HomeScreen />);

    act(() => {
      fireEvent.press(getByText('ring_timer_start'));
    });

    expect(mockStartManualSession).toHaveBeenCalledTimes(1);
    // After starting, the OUTSIDE badge and stop hint should appear
    expect(getByText('ring_timer_outside')).toBeTruthy();
    expect(getByText('ring_timer_tap_stop')).toBeTruthy();
    expect(getByTestId('icon-stop')).toBeTruthy();
    expect(queryByTestId('icon-play')).toBeNull();

    // Clean up: stop the timer so the interval does not outlive this test
    act(() => {
      fireEvent.press(getByText('ring_timer_tap_stop'));
    });
  });

  it('stops and saves the session when the running timer is pressed', () => {
    const { getByText, getByTestId } = render(<HomeScreen />);

    // Start the timer
    act(() => {
      fireEvent.press(getByText('ring_timer_start'));
    });
    expect(mockStartManualSession).toHaveBeenCalledTimes(1);

    // Stop the timer via the hint text (whole ring is tappable)
    act(() => {
      fireEvent.press(getByText('ring_timer_tap_stop'));
    });

    expect(mockStopFn).toHaveBeenCalledTimes(1);
    // Data should be refreshed (getTodayMinutes is called on loadData)
    expect(mockGetTodayMinutes).toHaveBeenCalled();
    // Ring should be back to idle state showing the play icon
    expect(getByTestId('icon-play')).toBeTruthy();
    expect(getByText('ring_timer_start')).toBeTruthy();
  });

  it('shows the running state indicators immediately when timer starts', () => {
    // The OUTSIDE badge renders as soon as timerRunning=true — no need to advance
    // fake timers, which would interfere with React's scheduler and cause cleanup hangs.
    const { getByText, getByTestId, queryByTestId } = render(<HomeScreen />);

    act(() => {
      fireEvent.press(getByText('ring_timer_start'));
    });

    expect(getByText('ring_timer_outside')).toBeTruthy();
    expect(getByText('ring_timer_tap_stop')).toBeTruthy();
    expect(getByTestId('icon-stop')).toBeTruthy();
    expect(queryByTestId('icon-play')).toBeNull();

    // Clean up: stop the timer so the interval does not outlive this test
    act(() => {
      fireEvent.press(getByText('ring_timer_tap_stop'));
    });
  });

  it('shows a swipe hint for pending session cards', () => {
    mockGetSessionsForDay.mockReturnValueOnce([
      {
        id: 1,
        startTime: Date.now(),
        endTime: Date.now() + 30 * 60 * 1000,
        durationMinutes: 30,
        userConfirmed: null,
        discarded: 0,
        source: 'gps',
      },
    ]);

    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-swipe-hint')).toBeTruthy();
  });

  it('hides the swipe hint for confirmed sessions', () => {
    mockGetSessionsForDay.mockReturnValueOnce([
      {
        id: 2,
        startTime: Date.now(),
        endTime: Date.now() + 20 * 60 * 1000,
        durationMinutes: 20,
        userConfirmed: 1,
        discarded: 0,
        source: 'gps',
      },
    ]);

    const { queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId('home-swipe-hint')).toBeNull();
  });
});
