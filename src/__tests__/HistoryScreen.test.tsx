import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HistoryScreen, { BarChart } from '../screens/HistoryScreen';

// ── Shared mocks for HistoryScreen component tests ──────────────────────────

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Jan 1',
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${Math.round(mins)}m`,
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
    isDark: false,
  }),
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

const mockGetSessionsForRange = jest.fn(
  (_from: number, _to: number) => [] as import('../storage/database').OutsideSession[]
);
const mockGetDailyTotalsForMonth = jest.fn(
  (_date: number) => [] as { date: number; minutes: number }[]
);
const mockGetCurrentDailyGoal = jest.fn(() => ({ targetMinutes: 30 }));

jest.mock('../storage/database', () => ({
  startOfDay: (ms: number) => realStartOfDay(ms),
  startOfWeek: (ms: number) => realStartOfWeek(ms),
  getSessionsForRange: (from: number, to: number) => mockGetSessionsForRange(from, to),
  getDailyTotalsForMonth: (date: number) => mockGetDailyTotalsForMonth(date),
  getCurrentDailyGoal: () => mockGetCurrentDailyGoal(),
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

  it('divides by days elapsed (3) when today is Wednesday of the current week', () => {
    jest.spyOn(Date, 'now').mockReturnValue(WEDNESDAY);

    // Mon=60, Tue=30, Wed=90, Thu–Sun=0 → total=180, avg=180/3=60
    mockGetSessionsForRange.mockImplementation((from: number) => {
      const minutes =
        from === MONDAY ? 60 : from === MONDAY + 86400000 ? 30 : from === WEDNESDAY ? 90 : 0;
      if (minutes === 0) return [];
      return [
        {
          startTime: from,
          endTime: from + minutes * 60000,
          durationMinutes: minutes,
          userConfirmed: 1,
          source: 'gps',
          confidence: 0.9,
          discarded: 0,
        },
      ];
    });

    const { getByText } = render(<HistoryScreen />);
    expect(getByText('60m')).toBeTruthy(); // avg = 180 / 3
    expect(getByText('180m')).toBeTruthy(); // total
  });

  it('divides by 7 when viewing a completed past week', () => {
    jest.spyOn(Date, 'now').mockReturnValue(WEDNESDAY);

    // The past week starts on Monday 2024-01-01
    const PAST_MONDAY = MONDAY - 7 * 86400000;

    // All 7 days have 14 minutes each → total=98, avg=14
    mockGetSessionsForRange.mockImplementation((from: number) => {
      if (from >= PAST_MONDAY && from < MONDAY) {
        return [
          {
            startTime: from,
            endTime: from + 14 * 60000,
            durationMinutes: 14,
            userConfirmed: 1,
            source: 'gps',
            confidence: 0.9,
            discarded: 0,
          },
        ];
      }
      return [];
    });

    const { getByText } = render(<HistoryScreen />);

    // Navigate to the previous week
    fireEvent.press(getByText('‹'));

    expect(getByText('98m')).toBeTruthy(); // total
    expect(getByText('14m')).toBeTruthy(); // avg = 98 / 7
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
});
