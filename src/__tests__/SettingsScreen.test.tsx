import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { PRIVACY_POLICY_URL } from '../utils/constants';

// Mock i18n
jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
  formatLocalDate: jest.fn(() => ''),
  formatLocalTime: jest.fn(() => ''),
}));

// Mock database
jest.mock('../storage/database', () => ({
  getKnownLocations: jest.fn(() => []),
  getSuggestedLocations: jest.fn(() => []),
  clearAllData: jest.fn(),
}));

// Mock detection
const mockToggleHealthConnect = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
const mockToggleGPS = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() => ({
    healthConnect: false,
    healthConnectPermission: false,
    gps: false,
    gpsPermission: false,
  })),
  toggleHealthConnect: (enabled: boolean) => mockToggleHealthConnect(enabled),
  toggleGPS: (enabled: boolean) => mockToggleGPS(enabled),
  recheckHealthConnect: jest.fn(() => Promise.resolve()),
  checkGPSPermissions: jest.fn(() => Promise.resolve()),
  requestGPSPermissions: jest.fn(() => Promise.resolve(false)),
  openHealthConnectSettings: jest.fn(() => Promise.resolve(true)),
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
import * as DetectionModule from '../detection/index';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('nav_settings')).toBeTruthy());
  });
});

describe('SettingsScreen detection toggles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
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
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
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
      healthConnect: true,
      healthConnectPermission: true,
      gps: false,
      gpsPermission: false,
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
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());
  });

  it('shows permission-missing label when GPS is enabled but permissions are missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_gps_permission_missing')).toBeTruthy());
  });

  it('does not show permission-missing label when HC toggle is off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { queryByText } = render(<SettingsScreen />);
    await waitFor(() => expect(queryByText('settings_hc_permission_missing')).toBeNull());
  });
});

describe('SettingsScreen privacy policy link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('renders privacy row with label and hint', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('settings_privacy')).toBeTruthy();
      expect(getByText('settings_privacy_sublabel')).toBeTruthy();
      expect(getByText('settings_privacy_hint')).toBeTruthy();
    });
  });

  it('opens privacy policy URL when privacy row is pressed', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_privacy_hint')).toBeTruthy());

    fireEvent.press(getByText('settings_privacy_hint'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    });
  });
});
