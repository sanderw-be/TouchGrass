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
  getKnownLocationsAsync: jest.fn(() => Promise.resolve([])),
  getSuggestedLocationsAsync: jest.fn(() => Promise.resolve([])),
  clearAllDataAsync: jest.fn(() => Promise.resolve()),
}));

// Mock detection
const mockToggleHealthConnect = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
const mockToggleGPS = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() =>
    Promise.resolve({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    })
  ),
  toggleHealthConnect: (enabled: boolean) => mockToggleHealthConnect(enabled),
  toggleGPS: (enabled: boolean) => mockToggleGPS(enabled),
  recheckHealthConnect: jest.fn(() => Promise.resolve()),
  checkGPSPermissions: jest.fn(() => Promise.resolve()),
  requestGPSPermissions: jest.fn(() => Promise.resolve(false)),
  openHealthConnectSettings: jest.fn(() => Promise.resolve(true)),
}));

// Mock permission issues emitter so we can verify badge refresh is triggered
const mockEmitPermissionIssuesChanged = jest.fn();
jest.mock('../utils/permissionIssuesChangedEmitter', () => ({
  emitPermissionIssuesChanged: () => mockEmitPermissionIssuesChanged(),
}));

// Mock navigation — useFocusEffect delegates to useEffect so it runs on mount
// Shared navigate mock so tests can inspect navigation calls
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.0' },
  },
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

  it('shows the app version in the About section', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('v1.2.0')).toBeTruthy());
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
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
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
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
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
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
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
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());
  });

  it('shows permission-missing label when GPS is enabled but permissions are missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: false,
    });

    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_gps_permission_missing')).toBeTruthy());
  });

  it('does not show permission-missing label when HC toggle is off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
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

describe('SettingsScreen About section navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to AboutApp when the TouchGrass row is pressed', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('TouchGrass')).toBeTruthy());

    fireEvent.press(getByText('TouchGrass'));

    expect(mockNavigate).toHaveBeenCalledWith('AboutApp');
  });
});

describe('SettingsScreen version badge opens DiagnosticSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the version badge', async () => {
    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('version-badge')).toBeTruthy());
  });

  it('opens the diagnostic sheet when version badge is pressed', async () => {
    const { getByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('version-badge')).toBeTruthy());

    expect(queryByTestId('diagnostic-sheet')).toBeNull();

    fireEvent.press(getByTestId('version-badge'));

    await waitFor(() => expect(getByTestId('diagnostic-sheet')).toBeTruthy());
  });

  it('closes the diagnostic sheet when the close button is pressed', async () => {
    const { getByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('version-badge')).toBeTruthy());

    fireEvent.press(getByTestId('version-badge'));
    await waitFor(() => expect(getByTestId('diagnostic-sheet')).toBeTruthy());

    fireEvent.press(getByTestId('diagnostic-close-btn'));

    await waitFor(() => expect(queryByTestId('diagnostic-sheet')).toBeNull());
  });
});

describe('SettingsScreen permission warning banner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows banner when GPS is enabled but permission is missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: false,
    });

    const { findByText } = render(<SettingsScreen />);
    await expect(findByText(/permission_issues_banner/)).resolves.toBeTruthy();
  });

  it('shows banner when Health Connect is enabled but permission is missing', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { findByText } = render(<SettingsScreen />);
    await expect(findByText(/permission_issues_banner/)).resolves.toBeTruthy();
  });

  it('does not show banner when all permissions are satisfied', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: true,
      gps: true,
      gpsPermission: true,
    });

    const { queryByText } = render(<SettingsScreen />);
    await waitFor(() => expect(queryByText(/permission_issues_banner/)).toBeNull());
  });

  it('does not show banner when features are disabled', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { queryByText } = render(<SettingsScreen />);
    await waitFor(() => expect(queryByText(/permission_issues_banner/)).toBeNull());
  });
});

describe('SettingsScreen permission explainer disable button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows disable button in HC permission sheet and disables HC when tapped', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: false });

    const { getByText, findByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());

    fireEvent.press(getByText('settings_hc_permission_missing'));

    await findByTestId('permission-explainer-sheet');

    await act(async () => {
      fireEvent.press(await findByTestId('permission-disable-btn'));
    });

    await waitFor(() => {
      expect(mockToggleHealthConnect).toHaveBeenCalledWith(false);
      expect(queryByTestId('permission-explainer-sheet')).toBeNull();
    });
  });

  it('shows disable button in GPS permission sheet and disables GPS when tapped', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: false,
    });
    mockToggleGPS.mockResolvedValue({ needsPermissions: false });

    const { getByText, findByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_gps_permission_missing')).toBeTruthy());

    fireEvent.press(getByText('settings_gps_permission_missing'));

    await findByTestId('permission-explainer-sheet');

    await act(async () => {
      fireEvent.press(await findByTestId('permission-disable-btn'));
    });

    await waitFor(() => {
      expect(mockToggleGPS).toHaveBeenCalledWith(false);
      expect(queryByTestId('permission-explainer-sheet')).toBeNull();
    });
  });
});

describe('SettingsScreen badge refresh on feature disable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits permission issues changed when HC is toggled off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: true,
      gps: false,
      gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: false });

    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('hc-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent(getByTestId('hc-toggle'), 'valueChange', false);
    });

    await waitFor(() => {
      expect(mockEmitPermissionIssuesChanged).toHaveBeenCalled();
    });
  });

  it('emits permission issues changed when GPS is toggled off', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: true,
    });
    mockToggleGPS.mockResolvedValue({ needsPermissions: false });

    const { getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('gps-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent(getByTestId('gps-toggle'), 'valueChange', false);
    });

    await waitFor(() => {
      expect(mockEmitPermissionIssuesChanged).toHaveBeenCalled();
    });
  });

  it('emits permission issues changed when HC is disabled via the permission sheet', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: false });

    const { getByText, findByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());

    fireEvent.press(getByText('settings_hc_permission_missing'));
    await findByTestId('permission-explainer-sheet');

    await act(async () => {
      fireEvent.press(await findByTestId('permission-disable-btn'));
    });

    await waitFor(() => {
      expect(mockEmitPermissionIssuesChanged).toHaveBeenCalled();
    });
  });
});
