import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import HistoryScreen, { BarChart } from '../screens/HistoryScreen';

// ── Shared mocks for HistoryScreen component tests ──────────────────────────

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
  // Re-run the callback whenever its identity changes (i.e. when useCallback's
  // deps like period/viewDate change), matching the real focus-effect behaviour.
  useFocusEffect: (cb: () => void) => {
    const React = require('react');

    React.useEffect(() => {
      cb();
    }, [cb]);
  },
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

// Real startOfDay / startOfWeek so the divisor logic works correctly in tests
const realStartOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const realStartOfWeek = (ms: number) => {
  const d = new Date(ms);
  const day = d.getDay();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 6) % 7));
  return monday.getTime();
};

const mockGetSessionsForRangeAsync = jest.fn((_from: number, _to: number) =>
  Promise.resolve([] as import('../storage').OutsideSession[])
);
const mockGetDailyTotalsForMonthAsync = jest.fn((_date: number) =>
  Promise.resolve([] as { date: number; minutes: number }[])
);
const mockGetCurrentDailyGoalAsync = jest.fn(() => Promise.resolve({ targetMinutes: 30 }));

jest.mock('../storage', () => ({
  startOfDay: (ms: number) => realStartOfDay(ms),
  startOfWeek: (ms: number) => realStartOfWeek(ms),
  getSessionsForRangeAsync: (from: number, to: number) => mockGetSessionsForRangeAsync(from, to),
  getDailyTotalsForMonthAsync: (date: number) => mockGetDailyTotalsForMonthAsync(date),
  getCurrentDailyGoalAsync: () => mockGetCurrentDailyGoalAsync(),
}));

// ── Weekly average divisor ───────────────────────────────────────────────────

describe('HistoryScreen weekly average', () => {
  // Monday 2024-01-08 and Wednesday 2024-01-10 (day 3 of that week)
  const MONDAY = new Date(2024, 0, 8).getTime();
  const WEDNESDAY = MONDAY + 2 * 86400000;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('divides by days elapsed (3) when today is Wednesday of the current week', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(WEDNESDAY);

    // Mon=60, Tue=30, Wed=90, Thu–Sun=0 → total=180, avg=180/3=60
    // Now returns all sessions for the full week range in a single call
    mockGetSessionsForRangeAsync.mockImplementation(() => {
      return Promise.resolve([
        {
          startTime: MONDAY,
          endTime: MONDAY + 60 * 60000,
          durationMinutes: 60,
          userConfirmed: 1,
          source: 'gps',
          confidence: 0.9,
          discarded: 0,
        },
        {
          startTime: MONDAY + 86400000,
          endTime: MONDAY + 86400000 + 30 * 60000,
          durationMinutes: 30,
          userConfirmed: 1,
          source: 'gps',
          confidence: 0.9,
          discarded: 0,
        },
        {
          startTime: WEDNESDAY,
          endTime: WEDNESDAY + 90 * 60000,
          durationMinutes: 90,
          userConfirmed: 1,
          source: 'gps',
          confidence: 0.9,
          discarded: 0,
        },
      ]);
    });

    const { getByText } = render(<HistoryScreen />);
    await waitFor(() => {
      expect(getByText('60m')).toBeTruthy(); // avg = 180 / 3
      expect(getByText('180m')).toBeTruthy(); // total
    });
  });

  it('divides by 7 when viewing a completed past week', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(WEDNESDAY);

    // The past week starts on Monday 2024-01-01
    const PAST_MONDAY = MONDAY - 7 * 86400000;

    // All 7 days have 14 minutes each → total=98, avg=14
    // Returns all sessions for the full week range in a single call
    mockGetSessionsForRangeAsync.mockImplementation((from: number, _to: number) => {
      // Only return data for the past week range
      if (from >= PAST_MONDAY && from < MONDAY) {
        const sessions = [];
        for (let i = 0; i < 7; i++) {
          const dayStart = PAST_MONDAY + i * 86400000;
          sessions.push({
            startTime: dayStart,
            endTime: dayStart + 14 * 60000,
            durationMinutes: 14,
            userConfirmed: 1,
            source: 'gps' as const,
            confidence: 0.9,
            discarded: 0,
          });
        }
        return Promise.resolve(sessions);
      }
      return Promise.resolve([]);
    });

    const { getByText } = render(<HistoryScreen />);

    // Wait for initial async render
    await waitFor(() => {
      expect(getByText('‹')).toBeTruthy();
    });

    // Navigate to the previous week
    await act(async () => {
      fireEvent.press(getByText('‹'));
    });

    await waitFor(() => {
      expect(getByText('98m')).toBeTruthy(); // total
      expect(getByText('14m')).toBeTruthy(); // avg = 98 / 7
    });
  });
});

// ── BarChart ─────────────────────────────────────────────────────────────────

describe('HistoryScreen BarChart', () => {
  it('sizes bars to the measured chart width', () => {
    const baseDate = new Date(2024, 0, 1).getTime();
    const data = Array.from({ length: 5 }).map((_, i) => ({
      date: baseDate + i * 86400000,
      minutes: (i + 1) * 10,
    }));

    const { getByTestId, getAllByTestId } = render(
      <BarChart data={data} target={30} maxValue={60} period="week" />
    );

    fireEvent(getByTestId('history-chart-area'), 'layout', {
      nativeEvent: { layout: { width: 200, height: 160, x: 0, y: 0 } },
    });

    const expectedWidth = 36; // (200 / 5) - 4
    const barWrappers = getAllByTestId('history-bar-wrapper');
    barWrappers.forEach((barWrapper) => {
      expect(barWrapper).toHaveStyle({ width: expectedWidth });
    });
  });

  it('shows axis labels and a full legend for context', () => {
    const baseDate = new Date(2024, 0, 1).getTime();
    const data = [
      { date: baseDate, minutes: 10 },
      { date: baseDate + 86400000, minutes: 0 },
    ];

    const { getByText } = render(<BarChart data={data} target={30} maxValue={60} period="month" />);

    expect(getByText('history_axis_minutes')).toBeTruthy();
    expect(getByText('history_axis_days_month')).toBeTruthy();
    expect(getByText('history_legend_goal_met')).toBeTruthy();
    expect(getByText('history_legend_below_goal')).toBeTruthy();
    expect(getByText('history_legend_today')).toBeTruthy();
    expect(getByText('history_legend_target')).toBeTruthy();
  });
});
