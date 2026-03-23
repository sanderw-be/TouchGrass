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
  getKnownLocations: jest.fn(() => []),
  getSuggestedLocations: jest.fn(() => []),
  clearAllData: jest.fn(),
}));

// Mock detection
const mockToggleHealthConnect = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() => Promise.resolve({ needsPermissions: false }));
const mockToggleGPS = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() => Promise.resolve({ needsPermissions: false }));
jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() => ({ healthConnect: false, healthConnectPermission: false, gps: false, gpsPermission: false })),
  toggleHealthConnect: (enabled: boolean) => mockToggleHealthConnect(enabled),
  toggleGPS: (enabled: boolean) => mockToggleGPS(enabled),
  recheckHealthConnect: jest.fn(() => Promise.resolve()),
  checkGPSPermissions: jest.fn(() => Promise.resolve()),
  requestGPSPermissions: jest.fn(() => Promise.resolve(false)),
  openHealthConnectSettings: jest.fn(() => Promise.resolve(true)),
}));

// Mock calendar service
jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  hasCalendarPermissions: jest.fn(() => Promise.resolve(false)),
  getSelectedCalendarId: jest.fn(() => ''),
  setSelectedCalendarId: jest.fn(),
  getWritableCalendars: jest.fn(() => Promise.resolve([])),
  getOrCreateTouchGrassCalendar: jest.fn(() => Promise.resolve('local-tg-id')),
  cleanupTouchGrassCalendars: jest.fn(() => Promise.resolve({ primaryCalendarId: 'local-tg-id', removedCalendars: 0, removedEvents: 0 })),
}));

// Mock navigation — useFocusEffect delegates to useEffect so it runs on mount
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => { React.useEffect(cb, []); },
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock IntroContext so useShowIntro returns a no-op in tests
jest.mock('../context/IntroContext', () => ({
  useShowIntro: () => jest.fn(),
  IntroContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

// Mock LanguageContext so useLanguage returns a stable locale in tests
const mockSetLocale = jest.fn();
jest.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: mockSetLocale }),
  LanguageContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

import SettingsScreen from '../screens/SettingsScreen';
import * as CalendarService from '../calendar/calendarService';
import * as DetectionModule from '../detection/index';

describe('SettingsScreen calendar duration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
  });

  it('renders without crashing', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('nav_settings')).toBeTruthy());
  });

  it('shows "Off" label when calendar is enabled and duration is 0', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '0';
      return def;
    });

    const { findByText } = render(<SettingsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('shows minutes label when calendar is enabled and duration is non-zero', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '15';
      return def;
    });

    const { findByText } = render(<SettingsScreen />);

    await expect(findByText('settings_calendar_duration_minutes')).resolves.toBeTruthy();
  });

  it('defaults to "Off" when no duration setting is stored', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      // calendar_default_duration not set → returns the default '0'
      return def;
    });

    const { findByText } = render(<SettingsScreen />);

    await expect(findByText('settings_calendar_duration_off')).resolves.toBeTruthy();
  });

  it('cycles from "Off" (0) to the first non-zero option (5 min) when tapped', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '0';
      return def;
    });

    const { findByText } = render(<SettingsScreen />);

    // Wait for calendar section to appear with "Off" label
    const durationRow = await findByText('settings_calendar_duration');
    expect(await findByText('settings_calendar_duration_off')).toBeTruthy();

    // Press to cycle to next value (5 min)
    await act(async () => {
      fireEvent.press(durationRow);
    });

    // After one cycle from 0, should show the minutes label
    await waitFor(() => expect(findByText('settings_calendar_duration_minutes')).resolves.toBeTruthy());
    expect(mockSetSetting).toHaveBeenCalledWith('calendar_default_duration', '5');
  });

  it('cycles back to "Off" from the last duration option (30 min)', async () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'calendar_integration_enabled') return '1';
      if (key === 'calendar_default_duration') return '30';
      return def;
    });

    const { findByText } = render(<SettingsScreen />);

    // Wait for calendar section showing 30 min
    const durationRow = await findByText('settings_calendar_duration');
    expect(await findByText('settings_calendar_duration_minutes')).toBeTruthy();

    // Press to cycle from 30 → wraps back to 0 (Off)
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
      { id: 'tg-local', title: 'TouchGrass', allowsModifications: true, source: { isLocalAccount: true } },
    ]);

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { findByText } = render(<SettingsScreen />);

    const selectRow = await findByText('settings_calendar_select');
    alertSpy.mockClear();

    await act(async () => {
      fireEvent.press(selectRow);
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('SettingsScreen detection toggles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: string) => def);
  });

  it('renders Health Connect and GPS switch rows', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('settings_health_connect')).toBeTruthy();
      expect(getByText('settings_gps')).toBeTruthy();
    });
  });

  it('calls toggleHealthConnect(true) when HC switch is turned on', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false, healthConnectPermission: false, gps: false, gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValueOnce({ needsPermissions: false });

    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('hc-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent(getByTestId('hc-toggle'), 'valueChange', true);
    });

    await waitFor(() => expect(mockToggleHealthConnect).toHaveBeenCalledWith(true));
  });

  it('calls toggleGPS(true) when GPS switch is turned on', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false, healthConnectPermission: false, gps: false, gpsPermission: false,
    });
    mockToggleGPS.mockResolvedValueOnce({ needsPermissions: false });

    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('gps-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent(getByTestId('gps-toggle'), 'valueChange', true);
    });

    await waitFor(() => expect(mockToggleGPS).toHaveBeenCalledWith(true));
  });

  it('calls toggleHealthConnect(false) when HC switch is turned off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: true, healthConnectPermission: true, gps: false, gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValueOnce({ needsPermissions: false });

    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('hc-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent(getByTestId('hc-toggle'), 'valueChange', false);
    });

    await waitFor(() => expect(mockToggleHealthConnect).toHaveBeenCalledWith(false));
  });

  it('shows permission-missing label when HC is enabled but permissions are missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: true, healthConnectPermission: false, gps: false, gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());
  });

  it('shows permission-missing label when GPS is enabled but permissions are missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false, healthConnectPermission: false, gps: true, gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_gps_permission_missing')).toBeTruthy());
  });

  it('does not show permission-missing label when HC toggle is off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false, healthConnectPermission: false, gps: false, gpsPermission: false,
    });

    const { queryByText } = render(<SettingsScreen />);
    await waitFor(() => expect(queryByText('settings_hc_permission_missing')).toBeNull());
  });
});
