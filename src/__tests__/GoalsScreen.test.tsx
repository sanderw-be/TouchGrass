import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
  formatLocalDate: jest.fn(() => ''),
  formatLocalTime: jest.fn(() => ''),
}));

// Mock database
const mockGetSettingAsync = jest.fn<Promise<string>, [string, string]>((key: string, def: string) =>
  Promise.resolve(def)
);
const mockSetSettingAsync = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());
jest.mock('../storage/database', () => ({
  getSettingAsync: (key: string, def: string) => mockGetSettingAsync(key, def),
  setSettingAsync: (key: string, value: string) => mockSetSettingAsync(key, value),
  getCurrentDailyGoalAsync: jest.fn(() => Promise.resolve({ targetMinutes: 30 })),
  getCurrentWeeklyGoalAsync: jest.fn(() => Promise.resolve({ targetMinutes: 150 })),
  setDailyGoalAsync: jest.fn(() => Promise.resolve()),
  setWeeklyGoalAsync: jest.fn(() => Promise.resolve()),
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

jest.mock('../utils/batteryOptimization', () => ({
  BATTERY_OPTIMIZATION_SETTING_KEY: 'battery_optimization_granted',
  openBatteryOptimizationSettings: jest.fn(() => Promise.resolve(true)),
  refreshBatteryOptimizationSetting: jest.fn(() => Promise.resolve(false)),
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
import {
  BATTERY_OPTIMIZATION_SETTING_KEY,
  openBatteryOptimizationSettings,
  refreshBatteryOptimizationSetting,
} from '../utils/batteryOptimization';

const mockOpenBatteryOptimizationSettings = openBatteryOptimizationSettings as jest.MockedFunction<
  typeof openBatteryOptimizationSettings
>;
const mockRefreshBatteryOptimizationSetting =
  refreshBatteryOptimizationSetting as jest.MockedFunction<
    typeof refreshBatteryOptimizationSetting
  >;
const originalPlatformOS = Platform.OS;

describe('GoalsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockRefreshBatteryOptimizationSetting.mockResolvedValue(false);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
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

describe('GoalsScreen battery optimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockRefreshBatteryOptimizationSetting.mockResolvedValue(false);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
  });

  it('shows the explainer sheet and opens settings on Android', async () => {
    const originalOS = Platform.OS;
    try {
      (Platform as any).OS = 'android';
      const { findByText, findByTestId, getByTestId } = render(<GoalsScreen />);

      const batteryRow = await findByText('settings_battery_optimization');

      await act(async () => {
        fireEvent.press(batteryRow);
      });

      await findByTestId('permission-explainer-sheet');

      await act(async () => {
        fireEvent.press(getByTestId('permission-open-settings-btn'));
      });

      expect(openBatteryOptimizationSettings).toHaveBeenCalled();
    } finally {
      (Platform as any).OS = originalOS;
    }
  });

  it('disables the battery row when already granted', async () => {
    const originalOS = Platform.OS;
    try {
      (Platform as any).OS = 'android';
      mockGetSettingAsync.mockImplementation((key: string, def: string) =>
        Promise.resolve(key === BATTERY_OPTIMIZATION_SETTING_KEY ? '1' : def)
      );
      mockRefreshBatteryOptimizationSetting.mockResolvedValue(true);
      const { findByText, getByTestId } = render(<GoalsScreen />);

      await findByText('settings_battery_optimization');

      await waitFor(() =>
        expect(getByTestId('battery-optimization-row').props.accessibilityState?.disabled).toBe(
          true
        )
      );
      expect(getByTestId('icon-checkmark-circle')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('battery-optimization-row'));
      });

      expect(openBatteryOptimizationSettings).not.toHaveBeenCalled();
    } finally {
      (Platform as any).OS = originalOS;
    }
  });

  it('re-enables the battery row when optimization is no longer ignored', async () => {
    const originalOS = Platform.OS;
    try {
      (Platform as any).OS = 'android';
      mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
      mockRefreshBatteryOptimizationSetting.mockResolvedValue(false);
      const { findByText, getByTestId, queryByTestId } = render(<GoalsScreen />);

      await findByText('settings_battery_optimization');

      await waitFor(() =>
        expect(getByTestId('battery-optimization-row').props.accessibilityState?.disabled).toBe(
          false
        )
      );
      expect(queryByTestId('icon-checkmark-circle')).toBeNull();
    } finally {
      (Platform as any).OS = originalOS;
    }
  });
});

describe('GoalsScreen calendar duration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockRefreshBatteryOptimizationSetting.mockResolvedValue(false);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    // Calendar settings sub-rows only show when permission is granted
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
  });

  it('shows "Off" label when calendar is enabled and duration is 0', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      if (key === 'calendar_default_duration') return Promise.resolve('0');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('shows minutes label when calendar is enabled and duration is non-zero', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      if (key === 'calendar_default_duration') return Promise.resolve('15');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_minutes')).resolves.toBeTruthy();
  });

  it('defaults to "Off" when no duration setting is stored', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('cycles from "Off" (0) to the first non-zero option (5 min) when tapped', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      if (key === 'calendar_default_duration') return Promise.resolve('0');
      return Promise.resolve(def);
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
    expect(mockSetSettingAsync).toHaveBeenCalledWith('calendar_default_duration', '5');
  });

  it('cycles back to "Off" from the last duration option (30 min)', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      if (key === 'calendar_default_duration') return Promise.resolve('30');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);

    const durationRow = await findByText('settings_calendar_duration');
    expect(await findByText('settings_calendar_duration_minutes')).toBeTruthy();

    await act(async () => {
      fireEvent.press(durationRow);
    });

    await waitFor(() => expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy());
    expect(mockSetSettingAsync).toHaveBeenCalledWith('calendar_default_duration', '0');
  });

  it('does not open calendar picker when only TouchGrass local calendar exists', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
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
    (Platform as any).OS = originalPlatformOS;
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
  });

  it('renders the catch-up reminders setting row', async () => {
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_label')).resolves.toBeTruthy();
  });

  it('shows "Medium" label when smart_catchup_reminders_count is 2 (default)', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('2');
      return Promise.resolve(def);
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_medium')).resolves.toBeTruthy();
  });

  it('shows "Off" when smart_catchup_reminders_count is 0', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_off')).resolves.toBeTruthy();
  });

  it('shows "Mellow" when smart_catchup_reminders_count is 1', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_mellow')).resolves.toBeTruthy();
  });

  it('shows "Aggressive" when smart_catchup_reminders_count is 3', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('3');
      return Promise.resolve(def);
    });
    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_catchup_aggressive')).resolves.toBeTruthy();
  });

  it('cycles from Off (0) → Mellow (1) when tapped', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);
    const labelRow = await findByText('settings_catchup_label');

    await act(async () => {
      fireEvent.press(labelRow);
    });

    expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_catchup_reminders_count', '1');
  });

  it('cycles from Aggressive (3) back to Off (0)', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_catchup_reminders_count') return Promise.resolve('3');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);
    const labelRow = await findByText('settings_catchup_label');

    await act(async () => {
      fireEvent.press(labelRow);
    });

    expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_catchup_reminders_count', '0');
  });
});

describe('GoalsScreen weather location permission', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    mockCheckWeatherLocation.mockResolvedValue(false);
    mockRequestWeatherLocation.mockResolvedValue(false);
    (Platform as any).OS = originalPlatformOS;
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
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_permission_missing')).resolves.toBeTruthy();
  });

  it('shows weather settings link when weather is enabled and location is granted', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    mockCheckWeatherLocation.mockResolvedValue(true);

    const { findByText, queryByText } = render(<GoalsScreen />);
    await expect(findByText('settings_weather_more')).resolves.toBeTruthy();
    await waitFor(() => expect(queryByText('settings_weather_permission_missing')).toBeNull());
  });

  it('does not show the permission hint when weather is disabled', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText('settings_weather_permission_missing')).toBeNull());
  });

  it('shows permission sheet when weather toggle is turned on without location permission', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
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
    expect(mockSetSettingAsync).not.toHaveBeenCalledWith('weather_enabled', '1');
  });

  it('does not show Alert when permission is missing while enabling weather', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
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
      expect(mockSetSettingAsync).not.toHaveBeenCalledWith('weather_enabled', '1');
    });
  });
});

describe('GoalsScreen calendar permission missing state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    mockCheckWeatherLocation.mockResolvedValue(false);
  });

  it('shows calendar permission missing red text when calendar is on but permission revoked', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_calendar_permission_missing')).resolves.toBeTruthy();
  });

  it('does not show calendar permission missing text when permission is granted', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (CalendarService.getWritableCalendars as jest.Mock).mockResolvedValue([]);

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText('settings_calendar_permission_missing')).toBeNull());
  });

  it('shows permission sheet when calendar toggle is turned on without permission', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
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
    expect(mockSetSettingAsync).not.toHaveBeenCalledWith('calendar_integration_enabled', '1');
  });

  it('shows data scope info in calendar permission sheet', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);

    const { getAllByRole, findByText } = render(<GoalsScreen />);
    await waitFor(() => getAllByRole('switch'));

    const switches = getAllByRole('switch');
    const calendarSwitch = switches[switches.length - 1];
    await act(async () => {
      fireEvent(calendarSwitch, 'valueChange', true);
    });

    await expect(findByText('settings_calendar_permission_body')).resolves.toBeTruthy();
  });
});

/** Retrieves the most recently registered AppState 'change' handler from the RN mock. */
function getLastAppStateChangeHandler(): ((state: string) => void) | undefined {
  const { AppState } = require('react-native');
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  return calls
    .filter(([event]: [string]) => event === 'change')
    .map(([, handler]: [string, (s: string) => void]) => handler)
    .at(-1);
}

describe('GoalsScreen auto-enable on permission grant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    mockCheckWeatherLocation.mockResolvedValue(false);
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);
  });

  it('auto-enables weather when permission is granted after the user opened the sheet', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { getAllByRole } = render(<GoalsScreen />);
    await waitFor(() => getAllByRole('switch'));

    // User tries to enable weather → sheet opens, pending flag is set
    const switches = getAllByRole('switch');
    await act(async () => {
      fireEvent(switches[0], 'valueChange', true);
    });

    // Simulate user granting the permission and returning to the app
    mockCheckWeatherLocation.mockResolvedValue(true);
    const changeHandler = getLastAppStateChangeHandler();
    if (changeHandler) {
      await act(async () => {
        await changeHandler('active');
      });
    }

    await waitFor(() => {
      expect(mockSetSettingAsync).toHaveBeenCalledWith('weather_enabled', '1');
    });
  });

  it('auto-enables calendar when permission is granted after the user opened the sheet', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);

    const { getAllByRole } = render(<GoalsScreen />);
    await waitFor(() => getAllByRole('switch'));

    // User tries to enable calendar → sheet opens, pending flag is set
    const switches = getAllByRole('switch');
    const calendarSwitch = switches[switches.length - 1];
    await act(async () => {
      fireEvent(calendarSwitch, 'valueChange', true);
    });

    // Simulate user granting the permission and returning to the app
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (CalendarService.getWritableCalendars as jest.Mock).mockResolvedValue([]);
    const changeHandler = getLastAppStateChangeHandler();
    if (changeHandler) {
      await act(async () => {
        await changeHandler('active');
      });
    }

    await waitFor(() => {
      expect(mockSetSettingAsync).toHaveBeenCalledWith('calendar_integration_enabled', '1');
    });
  });
});

describe('GoalsScreen smart reminders notification permission', () => {
  let mockGetPermissions: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
    mockRefreshBatteryOptimizationSetting.mockResolvedValue(false);
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    mockCheckWeatherLocation.mockResolvedValue(false);
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);
    // Access the globally mocked expo-notifications
    mockGetPermissions = require('expo-notifications').getPermissionsAsync as jest.Mock;
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
  });

  it('shows notification permission missing text when smart reminders are on and permission is denied', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('2');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText('settings_notification_permission_missing')).resolves.toBeTruthy();
  });

  it('does not show notification permission missing text when smart reminders are off', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText('settings_notification_permission_missing')).toBeNull());
  });

  it('does not show notification permission missing text when permission is granted', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('2');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'granted' });

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText('settings_notification_permission_missing')).toBeNull());
  });

  it('shows permission sheet when smart reminders row is tapped with count > 0 and permission denied', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('2');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    const { findByTestId } = render(<GoalsScreen />);
    const row = await findByTestId('smart-reminders-row');
    await act(async () => {
      fireEvent.press(row);
    });

    await expect(findByTestId('permission-explainer-sheet')).resolves.toBeTruthy();
  });

  it('shows permission sheet when smart reminders are tapped from off without notification permission', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    const { findByTestId } = render(<GoalsScreen />);
    const row = await findByTestId('smart-reminders-row');
    await act(async () => {
      fireEvent.press(row);
    });

    await expect(findByTestId('permission-explainer-sheet')).resolves.toBeTruthy();
    expect(mockSetSettingAsync).not.toHaveBeenCalledWith(
      'smart_reminders_count',
      expect.anything()
    );
  });

  it('cycles count normally when notification permission is granted', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'granted' });

    const { findByTestId } = render(<GoalsScreen />);
    const row = await findByTestId('smart-reminders-row');
    await act(async () => {
      fireEvent.press(row);
    });

    await waitFor(() => {
      expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_reminders_count', '1');
    });
  });

  it('auto-enables smart reminders when notification permission is granted after sheet was shown', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'denied' });

    const { findByTestId } = render(<GoalsScreen />);
    const row = await findByTestId('smart-reminders-row');

    // User taps to enable smart reminders → permission sheet opens, pending flag set
    await act(async () => {
      fireEvent.press(row);
    });

    // Simulate user granting notification permission and returning to the app
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    const changeHandler = getLastAppStateChangeHandler();
    if (changeHandler) {
      await act(async () => {
        await changeHandler('active');
      });
    }

    await waitFor(() => {
      expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_reminders_count', '1');
    });
  });
});

describe('GoalsScreen permission warning banner', () => {
  let mockGetPermissions: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = originalPlatformOS;
    mockGetSettingAsync.mockImplementation((key: string, def: string) => Promise.resolve(def));
    mockCheckWeatherLocation.mockResolvedValue(false);
    (CalendarService.hasCalendarPermissions as jest.Mock).mockResolvedValue(false);
    mockGetPermissions = require('expo-notifications').getPermissionsAsync as jest.Mock;
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
  });

  it('shows banner when smart reminders are on and notification permission is denied', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('2');
      return Promise.resolve(def);
    });

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText(/permission_issues_banner/)).resolves.toBeTruthy();
  });

  it('shows banner when weather is enabled and location permission is missing', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'weather_enabled') return Promise.resolve('1');
      return Promise.resolve(def);
    });
    mockCheckWeatherLocation.mockResolvedValue(false);

    const { findByText } = render(<GoalsScreen />);
    await expect(findByText(/permission_issues_banner/)).resolves.toBeTruthy();
  });

  it('does not show banner when all permissions are satisfied', async () => {
    mockGetSettingAsync.mockImplementation((key: string, def: string) => {
      if (key === 'smart_reminders_count') return Promise.resolve('0');
      if (key === 'weather_enabled') return Promise.resolve('0');
      return Promise.resolve(def);
    });
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockCheckWeatherLocation.mockResolvedValue(true);

    const { queryByText } = render(<GoalsScreen />);
    await waitFor(() => expect(queryByText(/permission_issues_banner/)).toBeNull());
  });
});
