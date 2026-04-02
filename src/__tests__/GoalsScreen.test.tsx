import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
  formatLocalDate: jest.fn(() => ''),
  formatLocalTime: jest.fn(() => ''),
}));

// Mock database
const mockGetSetting = jest.fn((key: string, def: string) => def);
const mockSetSetting = jest.fn();
jest.mock('../storage/database', () => ({
  getSetting: (key: string, def: string) => mockGetSetting(key, def),
  setSetting: (key: string, value: string) => mockSetSetting(key, value),
  getCurrentDailyGoal: jest.fn(() => ({ targetMinutes: 30 })),
  getCurrentWeeklyGoal: jest.fn(() => ({ targetMinutes: 150 })),
  setDailyGoal: jest.fn(),
  setWeeklyGoal: jest.fn(),
  getSelectedCalendarId: jest.fn(() => ''),
}));

// Mock calendar service
jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  hasCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  getSelectedCalendarId: jest.fn(() => ''),
  setSelectedCalendarId: jest.fn(),
  getWritableCalendars: jest.fn(() => Promise.resolve([])),
  getOrCreateTouchGrassCalendar: jest.fn(() => Promise.resolve('local-tg-id')),
}));

// Mock detection module — weather location permission helpers
const mockCheckWeatherLocation = jest.fn(() => Promise.resolve(false));
const mockRequestWeatherLocation = jest.fn(() => Promise.resolve(false));
jest.mock('../detection', () => ({
  checkWeatherLocationPermissions: () => mockCheckWeatherLocation(),
  requestWeatherLocationPermissions: () => mockRequestWeatherLocation(),
}));

// Mock expo-intent-launcher
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(() => Promise.resolve()),
}));

// Mock navigation — useFocusEffect delegates to useEffect so it runs on mount
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import GoalsScreen from '../screens/GoalsScreen';
import * as CalendarService from '../calendar/calendarService';

describe('GoalsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
    mockCheckWeatherLocation.mockResolvedValue(false);
    mockRequestWeatherLocation.mockResolvedValue(false);
  });

  it('renders without crashing', async () => {
    const { getByText } = render(<GoalsScreen />);
    await waitFor(() => expect(getByText('nav_goals')).toBeTruthy());
  });

  it('shows the WHO tip at the top before the goal cards', async () => {
    const { getByText } = render(<GoalsScreen />);
    await waitFor(() => {
      expect(getByText('goals_who_tip')).toBeTruthy();
    });
  });

  it('renders the reminders section', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_section_reminders')).resolves.toBeTruthy();
    await expect(findByText('settings_reminders_label')).resolves.toBeTruthy();
  });

  it('renders the weather section', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_title')).resolves.toBeTruthy();
  });

  it('renders the calendar section', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_section_calendar')).resolves.toBeTruthy();
  });
});

describe('GoalsScreen calendar duration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
    // Calendar settings sub-rows only show when permission is granted
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
  });

  it('shows "Off" label when calendar is enabled and duration is 0', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '0';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('shows minutes label when calendar is enabled and duration is non-zero', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '15';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_minutes')).resolves.toBeTruthy();
  });

  it('defaults to "Off" when no duration setting is stored', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('cycles from "Off" (0) to the first non-zero option (5 min) when tapped', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '0';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);

    const durationRow = await findByText('settings_calendar_duration');
    expect(await findByText('settings_calendar_duration_off')).toBeTruthy();

    await act(async () => {
      fireEvent.press(durationRow);
    });

    await waitFor(() =>
      expect(findByText('settings_calendar_duration_minutes')).resolves.toBeTruthy()
    );
    expect(mockSetSetting).toHaveBeenCalledWith('calendar_default_duration', '5');
  });

  it('cycles back to "Off" from the last duration option (30 min)', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '30';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);

    const durationRow = await findByText('settings_calendar_duration');
    expect(await findByText('settings_calendar_duration_minutes')).toBeTruthy();

    await act(async () => {
      fireEvent.press(durationRow);
    });

    await waitFor(() => expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy());
    expect(mockSetSetting).toHaveBeenCalledWith('calendar_default_duration', '0');
  });

  it('does not open calendar picker when only TouchGrass local calendar exists', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      return def;
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (CalendarService.getWritableCalendars as jest.Mock).mockResolvedValue([
      {
        id: 'tg-local',
        title: 'TouchGrass',
        allowsModifications: true,
        source: { isLocalAccount: true },
      },
    ]);

    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { findByText } = render(<GoalsScreen />);

    const selectRow = await findByText('settings_calendar_select');
    alertSpy.mockClear();

    await act(async () => {
      fireEvent.press(selectRow);
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('GoalsScreen catch-up reminders setting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
  });

  it('renders the catch-up reminders setting row', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_label')).resolves.toBeTruthy();
  });

  it('shows "Medium" label when smart_catchup_reminders_count is 2 (default)', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '2';
      return def;
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_medium')).resolves.toBeTruthy();
  });

  it('shows "Off" when smart_catchup_reminders_count is 0', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '0';
      return def;
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_off')).resolves.toBeTruthy();
  });

  it('shows "Mellow" when smart_catchup_reminders_count is 1', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '1';
      return def;
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_mellow')).resolves.toBeTruthy();
  });

  it('shows "Aggressive" when smart_catchup_reminders_count is 3', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '3';
      return def;
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_aggressive')).resolves.toBeTruthy();
  });

  it('cycles from Off (0) → Mellow (1) when tapped', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '0';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);
    const labelRow = await findByText('settings_catchup_label');

    await act(async () => {
      fireEvent.press(labelRow);
    });

    expect(mockSetSetting).toHaveBeenCalledWith('smart_catchup_reminders_count', '1');
  });

  it('cycles from Aggressive (3) back to Off (0)', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return '3';
      return def;
    });

    const { findByText } = render(<GoalsScreen />);
    const labelRow = await findByText('settings_catchup_label');

    await act(async () => {
      fireEvent.press(labelRow);
    });

    expect(mockSetSetting).toHaveBeenCalledWith('smart_catchup_reminders_count', '0');
  });
});

describe('GoalsScreen weather location permission', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
    mockCheckWeatherLocation.mockResolvedValue(false);
    mockRequestWeatherLocation.mockResolvedValue(false);
    alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows the weather section without GPS dependency', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_title')).resolves.toBeTruthy();
    await expect(findByText('settings_weather_enabled')).resolves.toBeTruthy();
  });

  it('shows location permission missing hint when weather is enabled but permission not granted', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return '1';
      return def;
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_location_permission_missing')).resolves.toBeTruthy();
    await expect(findByText('settings_weather_location_request')).resolves.toBeTruthy();
  });

  it('shows weather settings link when weather is enabled and location is granted', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return '1';
      return def;
    });
    mockCheckWeatherLocation.mockResolvedValue(true);

    const { findByText, queryByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_more')).resolves.toBeTruthy();
    await waitFor(() =>
      expect(queryByText('settings_weather_location_permission_missing')).toBeNull()
    );
  });

  it('does not show the permission hint when weather is disabled', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return '0';
      return def;
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() =>
      expect(queryByText('settings_weather_location_permission_missing')).toBeNull()
    );
  });

  it('shows permission sheet when weather toggle is turned on without location permission', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return '0';
      return def;
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { getAllByRole, findByTestId } = render(<GoalsScreen />);

    // Wait for the weather switch to be rendered
    await waitFor(() => getAllByRole('switch'));

    const switches = getAllByRole('switch');
    await act(async () => {
      fireEvent(switches[0], 'valueChange', true);
    });

    // Modal sheet should appear; permission request is not called inline
    await expect(findByTestId('permission-explainer-sheet')).resolves.toBeTruthy();
    expect(mockRequestWeatherLocation).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalledWith('weather_enabled', '1');
  });

  it('does not show Alert when permission is missing while enabling weather', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return '0';
      return def;
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { getAllByRole } = render(<GoalsScreen />);
    await waitFor(() => getAllByRole('switch'));

    const switches = getAllByRole('switch');
    await act(async () => {
      fireEvent(switches[0], 'valueChange', true);
    });

    await waitFor(() => {
      expect(alertSpy).not.toHaveBeenCalled();
      expect(mockSetSetting).not.toHaveBeenCalledWith('weather_enabled', '1');
    });
  });
});

describe('GoalsScreen calendar permission missing state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
    mockCheckWeatherLocation.mockResolvedValue(false);
  });

  it('shows calendar permission missing red text when calendar is on but permission revoked', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      return def;
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_calendar_permission_missing')).resolves.toBeTruthy();
  });

  it('does not show calendar permission missing text when permission is granted', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      return def;
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (CalendarService.getWritableCalendars as jest.Mock).mockResolvedValue([]);

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText('settings_calendar_permission_missing')).toBeNull());
  });

  it('shows permission sheet when calendar toggle is turned on without permission', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '0';
      return def;
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);

    const { getAllByRole, findByTestId } = render(<GoalsScreen />);
    await waitFor(() => getAllByRole('switch'));

    // The second switch in GoalsScreen is the calendar switch
    const switches = getAllByRole('switch');
    const calendarSwitch = switches[switches.length - 1];
    await act(async () => {
      fireEvent(calendarSwitch, 'valueChange', true);
    });

    await expect(findByTestId('permission-explainer-sheet')).resolves.toBeTruthy();
    expect(mockSetSetting).not.toHaveBeenCalledWith('calendar_integration_enabled', '1');
  });
});
