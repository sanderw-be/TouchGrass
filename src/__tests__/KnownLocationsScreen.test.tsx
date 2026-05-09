import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  t: (key: string, params?: any) => (params ? `${key}_with_params` : key),
  default: { locale: 'en' },
}));

// Mock database
const mockDenyKnownLocation = jest.fn<Promise<void>, [number]>(() => Promise.resolve());
const mockGetAllKnownLocations = jest.fn<Promise<any[]>, []>(() => Promise.resolve([]));
const mockGetSetting = jest.fn((key: string, def: string) => Promise.resolve(def));

jest.mock('../storage', () => ({
  getAllKnownLocationsAsync: () => mockGetAllKnownLocations(),
  denyKnownLocationAsync: (id: number) => mockDenyKnownLocation(id),
  getSettingAsync: (key: string, def: string) => mockGetSetting(key, def),
  setSettingAsync: jest.fn(() => Promise.resolve()),
}));

// Mock detection
jest.mock('../detection/index', () => ({
  getDetectionStatus: jest.fn(() =>
    Promise.resolve({
      healthConnect: false,
      healthConnectPermission: false,
      gps: true,
      gpsPermission: true,
    })
  ),
  refreshDetectionSync: jest.fn(),
}));

// Mock permission issues emitter
const mockEmitPermissionIssuesChanged = jest.fn();
jest.mock('../utils/permissionIssuesChangedEmitter', () => ({
  emitPermissionIssuesChanged: () => mockEmitPermissionIssuesChanged(),
}));

// Mock navigation
const mockSetParams = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, []);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      setOptions: mockSetOptions,
      setParams: mockSetParams,
    }),
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('@react-navigation/stack', () => ({}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock EditLocationSheet so we can trigger onSave
let capturedOnSave: (() => void) | null = null;
jest.mock('../components/EditLocationSheet', () => {
  return jest.fn((props) => {
    capturedOnSave = props.onSave;
    return null;
  });
});

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
        warningSurface: '#FFF9E6',
        warningText: '#B8860B',
        errorSurface: '#FFE6E6',
        error: '#D32F2F',
      },
      shadows: {
        soft: {},
      },
      locale: 'en',
    })
  ),
}));

import KnownLocationsScreen from '../screens/KnownLocationsScreen';

describe('KnownLocationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSave = null;
    jest.spyOn(Alert, 'alert');
  });

  it('renders suggested and active locations', async () => {
    mockGetAllKnownLocations.mockResolvedValue([
      {
        id: 1,
        label: 'Suggest',
        status: 'suggested',
        latitude: 0,
        longitude: 0,
        radiusMeters: 100,
        isIndoor: true,
      },
      {
        id: 2,
        label: 'Active',
        status: 'active',
        latitude: 0,
        longitude: 0,
        radiusMeters: 100,
        isIndoor: true,
      },
    ]);

    const { getByText } = render(<KnownLocationsScreen />);

    await waitFor(() => {
      expect(getByText('Suggest')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();
    });
  });

  it('calls emitPermissionIssuesChanged when a location is saved via EditLocationSheet', async () => {
    mockGetAllKnownLocations.mockResolvedValue([]);
    render(<KnownLocationsScreen />);

    await waitFor(() => {
      expect(capturedOnSave).toBeTruthy();
    });

    await act(async () => {
      capturedOnSave!();
    });

    expect(mockEmitPermissionIssuesChanged).toHaveBeenCalled();
  });

  it('calls emitPermissionIssuesChanged when a suggestion is denied', async () => {
    mockGetAllKnownLocations.mockResolvedValue([
      {
        id: 1,
        label: 'Suggest',
        status: 'suggested',
        latitude: 0,
        longitude: 0,
        radiusMeters: 100,
        isIndoor: true,
      },
    ]);

    const { getByText } = render(<KnownLocationsScreen />);

    const denyBtn = await waitFor(() => getByText('settings_location_deny'));

    await act(async () => {
      fireEvent.press(denyBtn);
    });

    // Check if Alert.alert was called (it's how we confirm deletion)
    expect(Alert.alert).toHaveBeenCalled();

    // Extract the "Confirm" button from Alert.alert and press it
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmBtn = alertCalls[0][2].find((b: any) => b.style === 'destructive');

    await act(async () => {
      await confirmBtn.onPress();
    });

    expect(mockDenyKnownLocation).toHaveBeenCalledWith(1);
    expect(mockEmitPermissionIssuesChanged).toHaveBeenCalled();
  });
});
