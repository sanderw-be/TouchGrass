import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { OutsideSession } from '../storage/database';

// ---------------------------------------------------------------------------
// Concurrency tracking
// ---------------------------------------------------------------------------
let activeFetchCount = 0;
let peakConcurrentFetches = 0;

function resetConcurrencyTracking() {
  activeFetchCount = 0;
  peakConcurrentFetches = 0;
}

/** Return a promise that resolves after `ms` milliseconds (real timer). */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wrap a value in a delayed promise and track the number of in-flight calls.
 * This lets us detect overlapping loadData batches: each loadData invocation
 * calls getTodayMinutesAsync exactly once, so the peak of `activeFetchCount`
 * tells us how many loadData batches were executing simultaneously.
 */
function withDelay<T>(value: T, ms = 50): Promise<T> {
  activeFetchCount++;
  peakConcurrentFetches = Math.max(peakConcurrentFetches, activeFetchCount);
  return new Promise((resolve) => {
    setTimeout(() => {
      activeFetchCount--;
      resolve(value);
    }, ms);
  });
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// Database mocks with artificial delay to simulate real DB response times.
// Only mockGetTodayMinutes uses `withDelay` (which tracks concurrency);
// the others simply delay without affecting the concurrency counter so that
// peakConcurrentFetches accurately reflects overlapping *loadData batches*
// rather than the parallel calls within a single Promise.all.
const mockGetTodayMinutes = jest.fn(() => withDelay(20));
const mockGetWeekMinutes = jest.fn(() => delay(50).then(() => 100));
const mockGetCurrentDailyGoal = jest.fn(() => delay(50).then(() => ({ targetMinutes: 60 })));
const mockGetCurrentWeeklyGoal = jest.fn(() => delay(50).then(() => ({ targetMinutes: 300 })));
const mockGetSessionsForDay = jest.fn<Promise<OutsideSession[]>, [number]>(() =>
  delay(50).then(() => [])
);
const mockGetDailyStreak = jest.fn(() => delay(50).then(() => 0));
const mockGetWeeklyStreak = jest.fn(() => delay(50).then(() => 0));
const mockGetSetting = jest.fn<Promise<string>, [string, string]>(() => Promise.resolve(''));
const mockSetSetting = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());

jest.mock('../storage/database', () => ({
  getTodayMinutesAsync: () => mockGetTodayMinutes(),
  getWeekMinutesAsync: () => mockGetWeekMinutes(),
  getCurrentDailyGoalAsync: () => mockGetCurrentDailyGoal(),
  getCurrentWeeklyGoalAsync: () => mockGetCurrentWeeklyGoal(),
  getSessionsForDayAsync: (dateMs: number) => mockGetSessionsForDay(dateMs),
  confirmSessionAsync: jest.fn(() => Promise.resolve()),
  getDailyStreakAsync: () => mockGetDailyStreak(),
  getWeeklyStreakAsync: () => mockGetWeeklyStreak(),
  getSettingAsync: (key: string, fallback: string) => mockGetSetting(key, fallback),
  setSettingAsync: (key: string, value: string) => mockSetSetting(key, value),
}));

jest.mock('../detection/manualCheckin', () => ({
  startManualSession: jest.fn(() => jest.fn()),
  logManualSession: jest.fn(),
}));

jest.mock('../detection/sessionConfidence', () => ({
  updateTimeSlotProbability: jest.fn(),
}));

let sessionsChangedCallback: (() => void) | null = null;
jest.mock('../utils/sessionsChangedEmitter', () => ({
  onSessionsChanged: jest.fn((cb: () => void) => {
    sessionsChangedCallback = cb;
    return () => {
      sessionsChangedCallback = null;
    };
  }),
  emitSessionsChanged: jest.fn(),
}));

jest.mock('../notifications/notificationManager', () => ({
  cancelRemindersIfGoalReached: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/widgetHelper', () => ({
  WIDGET_TIMER_KEY: 'widget_timer_start',
  isWidgetTimerRunning: (marker: string) => {
    const ts = parseInt(marker, 10);
    return !isNaN(ts) && ts > 0;
  },
  requestWidgetRefresh: jest.fn(() => Promise.resolve()),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retrieve the last registered AppState 'change' handler. */
function getAppStateChangeHandler(): ((state: string) => void) | undefined {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  return calls
    .filter(([event]: [string]) => event === 'change')
    .map(([, handler]: [string, (s: string) => void]) => handler)
    .at(-1);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeScreen fetch guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetConcurrencyTracking();
    sessionsChangedCallback = null;
  });

  it('calls database fetch functions exactly 1 time on initial mount', async () => {
    render(<HomeScreen />);
    // Wait for the delayed mock promises to resolve
    await act(async () => {
      await delay(150);
    });

    expect(mockGetTodayMinutes).toHaveBeenCalledTimes(1);
    expect(mockGetWeekMinutes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentDailyGoal).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentWeeklyGoal).toHaveBeenCalledTimes(1);
    expect(mockGetSessionsForDay).toHaveBeenCalledTimes(1);
    expect(mockGetDailyStreak).toHaveBeenCalledTimes(1);
    expect(mockGetWeeklyStreak).toHaveBeenCalledTimes(1);
  });

  it('drops redundant loadData calls and prevents concurrent fetches during an event storm', async () => {
    render(<HomeScreen />);
    // Wait for the initial mount load to complete
    await act(async () => {
      await delay(150);
    });

    // Reset counts so we only measure the storm
    mockGetTodayMinutes.mockClear();
    mockGetWeekMinutes.mockClear();
    mockGetSessionsForDay.mockClear();
    resetConcurrencyTracking();

    // --- Storm: rapidly fire multiple triggers that all invoke loadData ---
    await act(async () => {
      // 1) Five rapid sessionsChanged events (each calls loadData directly)
      for (let i = 0; i < 5; i++) {
        sessionsChangedCallback?.();
      }

      // 2) Simulate AppState transitions → syncWidgetTimer path
      const handler = getAppStateChangeHandler();
      if (handler) {
        handler('background');
        handler('active');
        handler('background');
        handler('active');
      }

      // Wait long enough for any in-flight fetches to settle
      await delay(300);
    });

    // With the isFetchingRef lock only the first loadData call should have
    // proceeded; the rest should have been dropped (early return).
    expect(mockGetTodayMinutes).toHaveBeenCalledTimes(1);
    expect(mockGetWeekMinutes).toHaveBeenCalledTimes(1);
    expect(mockGetSessionsForDay).toHaveBeenCalledTimes(1);

    // No overlapping batches should have been observed
    expect(peakConcurrentFetches).toBe(1);
  });
});
