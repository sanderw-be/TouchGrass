import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

jest.mock('../context/ThemeContext', () => {
  const mockColors = {
    mist: '#f5f5f5',
    card: '#ffffff',
    grass: '#4caf50',
    grassLight: '#81c784',
    grassDark: '#2e7d32',
    grassPale: '#e8f5e9',
    fog: '#e0e0e0',
    textPrimary: '#212121',
    textSecondary: '#757575',
    textMuted: '#9e9e9e',
    textInverse: '#ffffff',
    inactive: '#bdbdbd',
    error: '#f44336',
  };
  const mockShadows = { soft: {} };
  return {
    useTheme: () => ({ colors: mockColors, shadows: mockShadows }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetBackgroundLogs = jest.fn();
jest.mock('../storage/database', () => ({
  getBackgroundLogsAsync: (...args: unknown[]) => mockGetBackgroundLogs(...args),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
  };
});

import ActivityLogScreen from '../screens/ActivityLogScreen';

const EMPTY_LOGS: never[] = [];

const mockLogs = {
  health_connect: [
    {
      id: 1,
      timestamp: new Date('2024-01-15T10:00:00').getTime(),
      category: 'health_connect',
      message: 'Read 3 exercise record(s)',
    },
    {
      id: 2,
      timestamp: new Date('2024-01-15T10:01:00').getTime(),
      category: 'health_connect',
      message: 'Read 5 step record(s), recorded 1 session(s)',
    },
  ],
  gps: [
    {
      id: 3,
      timestamp: new Date('2024-01-15T11:00:00').getTime(),
      category: 'gps',
      message: 'Outside (no known location)',
    },
    {
      id: 4,
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      category: 'gps',
      message: 'Back inside at Home — recorded 30 min session',
    },
  ],
  reminder: [
    {
      id: 5,
      timestamp: new Date('2024-01-15T03:00:00').getTime(),
      category: 'reminder',
      message: 'Daily plan: 13:00, 17:00',
    },
    {
      id: 6,
      timestamp: new Date('2024-01-15T13:05:00').getTime(),
      category: 'reminder',
      message: 'Reminder fired at 13:00',
    },
  ],
};

describe('ActivityLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBackgroundLogs.mockImplementation((category: string) => {
      if (category === 'health_connect') return Promise.resolve(mockLogs.health_connect);
      if (category === 'gps') return Promise.resolve(mockLogs.gps);
      if (category === 'reminder') return Promise.resolve(mockLogs.reminder);
      return Promise.resolve(EMPTY_LOGS);
    });
  });

  it('renders without crashing', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => {
      expect(getByText('activity_log_section_hc')).toBeTruthy();
      expect(getByText('activity_log_section_gps')).toBeTruthy();
      expect(getByText('activity_log_section_reminders')).toBeTruthy();
    });
  });

  it('shows all three section headers', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => {
      expect(getByText('activity_log_section_hc')).toBeTruthy();
      expect(getByText('activity_log_section_gps')).toBeTruthy();
      expect(getByText('activity_log_section_reminders')).toBeTruthy();
    });
  });

  it('sections are collapsed by default (no log messages visible)', async () => {
    const { queryByText } = render(<ActivityLogScreen />);
    await waitFor(() => {
      expect(queryByText('Read 3 exercise record(s)')).toBeNull();
      expect(queryByText('Outside (no known location)')).toBeNull();
      expect(queryByText('Daily plan: 13:00, 17:00')).toBeNull();
    });
  });

  it('expands HC section when pressed', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_hc')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_hc'));

    await waitFor(() => {
      expect(getByText('Read 3 exercise record(s)')).toBeTruthy();
      expect(getByText('Read 5 step record(s), recorded 1 session(s)')).toBeTruthy();
    });
  });

  it('expands GPS section when pressed', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_gps')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_gps'));

    await waitFor(() => {
      expect(getByText('Outside (no known location)')).toBeTruthy();
      expect(getByText('Back inside at Home — recorded 30 min session')).toBeTruthy();
    });
  });

  it('only one section can be open at a time', async () => {
    const { getByText, queryByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_hc')).toBeTruthy());

    // Open HC
    fireEvent.press(getByText('activity_log_section_hc'));
    await waitFor(() => expect(getByText('Read 3 exercise record(s)')).toBeTruthy());

    // Open GPS — HC should close
    fireEvent.press(getByText('activity_log_section_gps'));
    await waitFor(() => {
      expect(getByText('Outside (no known location)')).toBeTruthy();
      expect(queryByText('Read 3 exercise record(s)')).toBeNull();
    });
  });

  it('collapses section when pressed again', async () => {
    const { getByText, queryByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_hc')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_hc'));
    await waitFor(() => expect(getByText('Read 3 exercise record(s)')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_hc'));
    await waitFor(() => expect(queryByText('Read 3 exercise record(s)')).toBeNull());
  });

  it('shows empty text when there are no logs', async () => {
    mockGetBackgroundLogs.mockReturnValue(Promise.resolve(EMPTY_LOGS));
    const { getByText, getAllByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_hc')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_hc'));

    await waitFor(() => {
      const emptyMessages = getAllByText('activity_log_empty');
      expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('groups reminder logs by day and shows day headers', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_reminders')).toBeTruthy());

    fireEvent.press(getByText('activity_log_section_reminders'));

    // Day label should appear (format: "Mon, Jan 15")
    await waitFor(() => {
      // Messages should not be visible yet (day is collapsed)
      expect(() => getByText('Daily plan: 13:00, 17:00')).toThrow();
    });
  });

  it('expands a reminder day to show its entries', async () => {
    const { getByText } = render(<ActivityLogScreen />);
    await waitFor(() => expect(getByText('activity_log_section_reminders')).toBeTruthy());

    // Open reminders section
    fireEvent.press(getByText('activity_log_section_reminders'));

    // Find and press the day header (it shows the formatted date)
    await waitFor(() => {
      // The day label should be visible
      expect(getByText(/15 Jan|Jan 15/)).toBeTruthy();
    });
    fireEvent.press(getByText(/15 Jan|Jan 15/));

    await waitFor(() => {
      expect(getByText('Daily plan: 13:00, 17:00')).toBeTruthy();
      expect(getByText('Reminder fired at 13:00')).toBeTruthy();
    });
  });

  it('loads logs on focus', async () => {
    render(<ActivityLogScreen />);
    await waitFor(() => {
      expect(mockGetBackgroundLogs).toHaveBeenCalledWith('health_connect');
      expect(mockGetBackgroundLogs).toHaveBeenCalledWith('gps');
      expect(mockGetBackgroundLogs).toHaveBeenCalledWith('reminder');
    });
  });

  it('reloads logs when pull-to-refresh is triggered', async () => {
    jest.useFakeTimers();
    const { UNSAFE_getByType } = render(<ActivityLogScreen />);
    await waitFor(() => expect(mockGetBackgroundLogs).toHaveBeenCalledTimes(3));

    mockGetBackgroundLogs.mockClear();

    // Trigger the RefreshControl's onRefresh callback
    const scrollView = UNSAFE_getByType(require('react-native').ScrollView);
    const { onRefresh } = scrollView.props.refreshControl.props;
    expect(typeof onRefresh).toBe('function');

    // onRefresh is now async, wrap in act
    await act(async () => {
      onRefresh();
      // Advance timers past the minimum refresh duration
      jest.runAllTimers();
    });

    // After the timer fires, logs should be reloaded
    await waitFor(() => expect(mockGetBackgroundLogs).toHaveBeenCalledTimes(3));
    jest.useRealTimers();
  });
});
