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
  getDeviceSupportedLocale: jest.fn(() => 'en'),
}));

// Mock database
jest.mock('../storage', () => ({
  getKnownLocationsAsync: jest.fn(() => Promise.resolve([])),
  getSuggestedLocationsAsync: jest.fn(() => Promise.resolve([])),
  clearAllDataAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
  getBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
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
  verifyHealthConnectPermissions: jest.fn(() => Promise.resolve()),
  checkGPSPermissions: jest.fn(() => Promise.resolve()),
  requestGPSPermissions: jest.fn(() => Promise.resolve(false)),
  requestHealthPermissions: jest.fn(() => Promise.resolve(true)),
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
    useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
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

// Mock App Store
const mockSetLocale = jest.fn();
const mockHandleShowIntro = jest.fn();
jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      locale: 'en',
      setLocale: mockSetLocale,
      handleShowIntro: mockHandleShowIntro,
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
      },
    })
  ),
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

  it('shows collapsed language row with current language and "Language"', async () => {
    const { getByText, queryByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('Language')).toBeTruthy();
    });
    // Options should be hidden when collapsed
    expect(queryByText('Deutsch')).toBeNull();
  });

  it('expands language picker when tapped and shows all options', async () => {
    const { getByText, getByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('language-picker-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('language-picker-toggle'));
    });

    await waitFor(() => {
      expect(getByText('settings_theme_system (English)')).toBeTruthy();
      expect(getByText('Deutsch')).toBeTruthy();
      expect(getByText('Español')).toBeTruthy();
      expect(getByText('Português (Portugal)')).toBeTruthy();
      expect(getByText('Português (Brasil)')).toBeTruthy();
      expect(getByText('Français')).toBeTruthy();
      expect(getByText('日本語')).toBeTruthy();
    });
  });

  it('calls setLocale and collapses picker when a language is selected', async () => {
    const { getByText, getByTestId, queryByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('language-picker-toggle')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('language-picker-toggle'));
    });

    const systemRow = await waitFor(() => getByText('settings_theme_system (English)'));

    await act(async () => {
      fireEvent.press(systemRow);
    });

    expect(mockSetLocale).toHaveBeenCalledWith('system');
    // Picker should collapse after selection
    await waitFor(() => expect(queryByText('Deutsch')).toBeNull());
  });
});

describe('SettingsScreen initial loading', () => {
  it('shows ActivityIndicator while initializing', async () => {
    // Create a promise that we can control
    let resolveDetection: (value: any) => void;
    const detectionPromise = new Promise((resolve) => {
      resolveDetection = resolve;
    });
    (DetectionModule.getDetectionStatus as jest.Mock).mockReturnValue(detectionPromise);

    const { getAllByTestId, queryByTestId } = render(<SettingsScreen />);

    // Loader should be visible
    expect(getAllByTestId('switch-loader').length).toBeGreaterThan(0);
    // Switches should not be visible yet
    expect(queryByTestId('hc-toggle')).toBeNull();
    expect(queryByTestId('gps-toggle')).toBeNull();

    // Resolve the promise
    await act(async () => {
      resolveDetection!({
        healthConnect: false,
        healthConnectPermission: false,
        gps: false,
        gpsPermission: false,
      });
    });

    // Now switches should be visible and loaders gone
    await waitFor(() => {
      expect(queryByTestId('switch-loader')).toBeNull();
      expect(queryByTestId('hc-toggle')).toBeTruthy();
      expect(queryByTestId('gps-toggle')).toBeTruthy();
    });
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

  it('navigates to HealthConnectRationale when Connect is pressed on the HC permission sheet', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: true,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });

    const { getByText, findByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('settings_hc_permission_missing')).toBeTruthy());

    fireEvent.press(getByText('settings_hc_permission_missing'));
    await findByTestId('permission-explainer-sheet');

    await act(async () => {
      fireEvent.press(await findByTestId('permission-open-settings-btn'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('HealthConnectRationale');
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

describe('SettingsScreen cancel permission sheet reverts enabled state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls toggleHealthConnect(false) when Cancel is pressed after HC was enabled with missing permissions', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: true });

    const { getByTestId, findByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('hc-toggle')).toBeTruthy());

    // Toggle HC ON → toggleHealthConnect(true) called, sheet shown
    await act(async () => {
      fireEvent(getByTestId('hc-toggle'), 'valueChange', true);
    });

    await findByTestId('permission-explainer-sheet');

    // Press Cancel → should revert by calling toggleHealthConnect(false)
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: false });
    await act(async () => {
      fireEvent.press(await findByTestId('permission-cancel-btn'));
    });

    await waitFor(() => {
      expect(mockToggleHealthConnect).toHaveBeenCalledWith(false);
      expect(queryByTestId('permission-explainer-sheet')).toBeNull();
    });
  });

  it('calls toggleGPS(false) when Cancel is pressed after GPS was enabled with missing permissions', async () => {
    (DetectionModule.getDetectionStatus as jest.Mock).mockResolvedValue({
      healthConnect: false,
      healthConnectPermission: false,
      gps: false,
      gpsPermission: false,
    });
    mockToggleGPS.mockResolvedValue({ needsPermissions: true });

    const { getByTestId, findByTestId, queryByTestId } = render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('gps-toggle')).toBeTruthy());

    // Toggle GPS ON → toggleGPS(true) called, sheet shown
    await act(async () => {
      fireEvent(getByTestId('gps-toggle'), 'valueChange', true);
    });

    await findByTestId('permission-explainer-sheet');

    // Press Cancel → should revert by calling toggleGPS(false)
    mockToggleGPS.mockResolvedValue({ needsPermissions: false });
    await act(async () => {
      fireEvent.press(await findByTestId('permission-cancel-btn'));
    });

    await waitFor(() => {
      expect(mockToggleGPS).toHaveBeenCalledWith(false);
      expect(queryByTestId('permission-explainer-sheet')).toBeNull();
    });
  });
});
