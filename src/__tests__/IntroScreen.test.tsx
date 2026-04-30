import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import IntroScreen from '../screens/IntroScreen';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import { requestHealthPermissions } from '../detection';

// Mock the i18n module
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Mock detection module
const mockToggleHealthConnect = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
const mockToggleGPS = jest.fn<Promise<{ needsPermissions: boolean }>, [boolean]>(() =>
  Promise.resolve({ needsPermissions: false })
);
jest.mock('../detection/index', () => ({
  toggleHealthConnect: (enabled: boolean) => mockToggleHealthConnect(enabled),
  toggleGPS: (enabled: boolean) => mockToggleGPS(enabled),
  toggleAR: jest.fn(() => Promise.resolve({ needsPermissions: false })),
  verifyHealthConnectPermissions: jest.fn(() => Promise.resolve(false)),
  requestGPSPermissions: jest.fn(() => Promise.resolve({ granted: false, canAskAgain: true })),
  checkGPSPermissions: jest.fn(() => Promise.resolve(false)),
  requestHealthPermissions: jest.fn(() => Promise.resolve(true)),
  checkWeatherLocationPermissions: jest.fn(() => Promise.resolve(false)),
  clampRadiusMeters: jest.fn((r) => r),
}));
// Mock PermissionService
jest.mock('../detection/PermissionService', () => ({
  PermissionService: {
    requestActivityRecognitionPermissions: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true })
    ),
    checkActivityRecognitionPermissions: jest.fn(() => Promise.resolve(true)),
  },
}));

// Mock notification manager
jest.mock('../notifications/notificationManager', () => ({
  getNotificationInfrastructureService: () => ({
    requestNotificationPermissions: jest.fn(() =>
      Promise.resolve({ granted: false, canAskAgain: true })
    ),
  }),
}));

// Mock calendar service
const mockRequestCalendarPermissions = jest.fn(() =>
  Promise.resolve({ granted: false, canAskAgain: true })
);
const mockHasCalendarPermissions = jest.fn(() => Promise.resolve(false));
jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: () => mockRequestCalendarPermissions(),
  hasCalendarPermissions: () => mockHasCalendarPermissions(),
  getOrCreateTouchGrassCalendar: jest.fn(() => Promise.resolve('local-tg-id')),
  setSelectedCalendarId: jest.fn(),
}));

// Mock database
const mockGetSettingAsync = jest.fn<Promise<string>, [string, string]>(
  (key: string, fallback: string) => Promise.resolve(fallback)
);
const mockSetSettingAsync = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());
jest.mock('../storage', () => ({
  getSettingAsync: (key: string, fallback: string) => mockGetSettingAsync(key, fallback),
  setSettingAsync: (key: string, value: string) => mockSetSettingAsync(key, value),
}));

describe('IntroScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingAsync.mockImplementation((key: string, fallback: string) =>
      Promise.resolve(fallback)
    );
    mockHasCalendarPermissions.mockResolvedValue(false);
    mockRequestCalendarPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockToggleHealthConnect.mockResolvedValue({ needsPermissions: false });
    mockToggleGPS.mockResolvedValue({ needsPermissions: false });
  });

  it('renders without crashing', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);

    // Check that the welcome step is shown
    expect(getByText('intro_welcome_title')).toBeTruthy();
  });

  it('renders progress bar', () => {
    const onComplete = jest.fn();
    const { UNSAFE_getAllByType } = render(<IntroScreen onComplete={onComplete} />);

    // Check that the component tree contains View elements (progress bar)
    // This is a basic smoke test to ensure the component structure is intact
    const views = UNSAFE_getAllByType('View' as any);
    expect(views.length).toBeGreaterThan(0);
  });

  it('renders Next button', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);

    expect(getByText('intro_next')).toBeTruthy();
  });

  it('renders Skip button', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);

    expect(getByText('intro_skip')).toBeTruthy();
  });

  it('has 6 steps (welcome → hc → location → notifications → calendar → ready)', () => {
    // The progress bar width is ((index+1)/steps.length)*100; at welcome (index 0) that is (1/6)*100 ≈ 16.67%
    // We simply verify we can advance through enough steps to reach the calendar step
    const onComplete = jest.fn();
    const { getByText, queryByText } = render(<IntroScreen onComplete={onComplete} />);

    // Step 1: welcome
    expect(getByText('intro_welcome_title')).toBeTruthy();

    // Advance to step 2: health-connect
    fireEvent.press(getByText('intro_next'));
    expect(getByText('hc_rationale_title')).toBeTruthy();

    // Advance to step 3: location
    fireEvent.press(getByText('intro_next'));
    expect(getByText('intro_location_title')).toBeTruthy();

    // Advance to step 4: notifications
    fireEvent.press(getByText('intro_next'));
    expect(getByText('intro_notifications_title')).toBeTruthy();

    // Advance to step 5: calendar
    fireEvent.press(getByText('intro_next'));
    expect(getByText('intro_calendar_title')).toBeTruthy();

    // Skip button still visible (not yet on ready step)
    expect(queryByText('intro_skip')).toBeTruthy();
  });

  describe('Calendar step', () => {
    async function navigateToCalendarStep() {
      const onComplete = jest.fn();
      const utils = render(<IntroScreen onComplete={onComplete} />);
      // welcome → hc → location → notifications → calendar
      for (let i = 0; i < 4; i++) {
        fireEvent.press(utils.getByText('intro_next'));
      }
      await waitFor(() => expect(utils.getByText('intro_calendar_title')).toBeTruthy());
      return { ...utils, onComplete };
    }

    it('renders the calendar step with permission button and settings controls', async () => {
      const { getByText } = await navigateToCalendarStep();

      expect(getByText('intro_calendar_title')).toBeTruthy();
      expect(getByText('intro_calendar_button')).toBeTruthy();
      expect(getByText('intro_calendar_buffer_label')).toBeTruthy();
      expect(getByText('intro_calendar_duration_label')).toBeTruthy();
      expect(getByText('intro_calendar_hint')).toBeTruthy();
    });

    it('shows the data scope explainer in the calendar step', async () => {
      const { getByText } = await navigateToCalendarStep();

      expect(getByText('intro_calendar_data_scope')).toBeTruthy();
    });

    it('calls requestCalendarPermissions and enables integration when connect button is pressed', async () => {
      mockRequestCalendarPermissions.mockResolvedValueOnce({ granted: true, canAskAgain: true });
      const { getByText } = await navigateToCalendarStep();

      await act(async () => {
        fireEvent.press(getByText('intro_calendar_button'));
      });

      // Calendar uses raw expo-calendar mock in IntroScreen
      await waitFor(() => {
        expect(mockSetSettingAsync).toHaveBeenCalledWith('calendar_integration_enabled', '1');
      });
    });

    it('shows granted state when permission is already granted', async () => {
      mockHasCalendarPermissions.mockResolvedValue(true);
      const { getByText } = await navigateToCalendarStep();

      await waitFor(() => {
        expect(getByText('intro_calendar_button_granted')).toBeTruthy();
      });
    });

    it('auto-enables calendar integration if permission is already granted', async () => {
      mockHasCalendarPermissions.mockResolvedValue(true);
      mockGetSettingAsync.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return Promise.resolve('0');
        return Promise.resolve(fallback);
      });

      await navigateToCalendarStep();

      await waitFor(() => {
        expect(mockSetSettingAsync).toHaveBeenCalledWith('calendar_integration_enabled', '1');
      });
    });

    it('cycles the calendar buffer when tapped', async () => {
      const { getByText } = await navigateToCalendarStep();

      const bufferRow = getByText('intro_calendar_buffer_label');
      await act(async () => {
        fireEvent.press(bufferRow);
      });

      expect(mockSetSettingAsync).toHaveBeenCalledWith(
        'calendar_buffer_minutes',
        expect.any(String)
      );
    });

    it('cycles the calendar duration when tapped', async () => {
      const { getByText } = await navigateToCalendarStep();

      const durationRow = getByText('intro_calendar_duration_label');
      await act(async () => {
        fireEvent.press(durationRow);
      });

      expect(mockSetSettingAsync).toHaveBeenCalledWith(
        'calendar_default_duration',
        expect.any(String)
      );
    });
  });

  describe('Health Connect step', () => {
    let originalPlatformOS: string;

    beforeAll(() => {
      const Platform = require('react-native').Platform;
      originalPlatformOS = Platform.OS;
      Platform.OS = 'android';
    });

    afterAll(() => {
      const Platform = require('react-native').Platform;
      Platform.OS = originalPlatformOS;
    });

    async function navigateToHCStep() {
      const onComplete = jest.fn();
      const utils = render(<IntroScreen onComplete={onComplete} />);
      // welcome → health-connect
      fireEvent.press(utils.getByText('intro_next'));
      await waitFor(() => expect(utils.getByText('hc_rationale_title')).toBeTruthy());
      return { ...utils, onComplete };
    }

    it('calls toggleHealthConnect(true) when connect button is pressed', async () => {
      const { getByText } = await navigateToHCStep();

      await act(async () => {
        fireEvent.press(getByText('intro_hc_button'));
      });

      expect(mockToggleHealthConnect).toHaveBeenCalledWith(true);
    });

    it('shows granted state when toggleHealthConnect returns needsPermissions=false', async () => {
      mockToggleHealthConnect.mockResolvedValueOnce({ needsPermissions: false });
      const { getByText } = await navigateToHCStep();

      await act(async () => {
        fireEvent.press(getByText('intro_hc_button'));
      });

      await waitFor(() => expect(getByText('intro_hc_button_granted')).toBeTruthy());
    });

    it('requests Health Connect permissions when needed', async () => {
      mockToggleHealthConnect.mockResolvedValueOnce({ needsPermissions: true });
      const { getByText } = await navigateToHCStep();

      await act(async () => {
        fireEvent.press(getByText('intro_hc_button'));
      });

      await waitFor(() => expect(requestHealthPermissions).toHaveBeenCalled());
    });
  });

  describe('Location step', () => {
    async function navigateToLocationStep() {
      const onComplete = jest.fn();
      const utils = render(<IntroScreen onComplete={onComplete} />);
      // welcome → hc → location
      fireEvent.press(utils.getByText('intro_next'));
      fireEvent.press(utils.getByText('intro_next'));
      await waitFor(() => expect(utils.getByText('intro_location_title')).toBeTruthy());
      return { ...utils, onComplete };
    }

    it('calls toggleGPS(true) when grant button is pressed', async () => {
      const { getByText } = await navigateToLocationStep();

      await act(async () => {
        fireEvent.press(getByText('intro_location_button'));
      });

      expect(mockToggleGPS).toHaveBeenCalledWith(true);
    });

    it('shows granted state when toggleGPS returns needsPermissions=false', async () => {
      mockToggleGPS.mockResolvedValueOnce({ needsPermissions: false });
      const { getByText } = await navigateToLocationStep();

      await act(async () => {
        fireEvent.press(getByText('intro_location_button'));
      });

      await waitFor(() => expect(getByText('intro_location_button_granted')).toBeTruthy());
    });

    it('requests GPS permissions when permissions are needed', async () => {
      const { requestGPSPermissions } = require('../detection/index');
      mockToggleGPS.mockResolvedValueOnce({ needsPermissions: true });
      (requestGPSPermissions as jest.Mock).mockResolvedValueOnce({
        granted: true,
        canAskAgain: true,
      });
      const { getByText } = await navigateToLocationStep();

      await act(async () => {
        fireEvent.press(getByText('intro_location_button'));
      });

      await waitFor(() => expect(requestGPSPermissions).toHaveBeenCalled());
    });
  });

  describe('Ready step', () => {
    async function navigateToReadyStep(calGranted = false) {
      mockHasCalendarPermissions.mockResolvedValue(calGranted);
      const onComplete = jest.fn();
      const utils = render(<IntroScreen onComplete={onComplete} />);
      // welcome → hc → location → notifications → calendar → ready
      for (let i = 0; i < 5; i++) {
        fireEvent.press(utils.getByText('intro_next'));
      }
      await waitFor(() => expect(utils.getByText('intro_ready_title')).toBeTruthy());
      return { ...utils, onComplete };
    }

    it('renders the ready step with calendar checklist item', async () => {
      const { getByText } = await navigateToReadyStep();

      expect(getByText('intro_ready_title')).toBeTruthy();
      expect(getByText('intro_ready_checklist_item_calendar')).toBeTruthy();
    });

    it('shows "Get Started" button on ready step', async () => {
      const { getByText, queryByText } = await navigateToReadyStep();

      expect(getByText('intro_get_started')).toBeTruthy();
      expect(queryByText('intro_skip')).toBeNull();
    });

    it('calls onComplete when Get Started is pressed', async () => {
      const { getByText, onComplete } = await navigateToReadyStep();

      await act(async () => {
        fireEvent.press(getByText('intro_get_started'));
      });

      expect(onComplete).toHaveBeenCalled();
    });

    it('hides widget hint on non-Android platforms', async () => {
      const { queryByText } = await navigateToReadyStep();
      expect(queryByText('intro_ready_widget_body')).toBeNull();
    });

    describe('saveOnboardingSettings', () => {
      let mockGetNotifPermissions: jest.Mock;
      let mockCheckGPS: jest.Mock;
      let mockCheckWeather: jest.Mock;

      beforeEach(() => {
        mockSetSettingAsync.mockClear();
        mockGetNotifPermissions = require('expo-notifications').getPermissionsAsync as jest.Mock;
        mockCheckGPS = require('../detection/index').checkGPSPermissions as jest.Mock;
        mockCheckWeather = require('../detection/index')
          .checkWeatherLocationPermissions as jest.Mock;
      });

      it('enables smart reminders when notification permission is granted', async () => {
        mockGetNotifPermissions.mockResolvedValue({ status: 'granted' });
        mockCheckGPS.mockResolvedValue(false);
        mockCheckWeather.mockResolvedValue(false);

        const { getByText } = await navigateToReadyStep();

        await act(async () => {
          fireEvent.press(getByText('intro_get_started'));
        });

        expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_reminders_count', '2');
      });

      it('enables weather when both weather location and notification permissions are granted', async () => {
        mockGetNotifPermissions.mockResolvedValue({ status: 'granted' });
        mockCheckGPS.mockResolvedValue(true);
        mockCheckWeather.mockResolvedValue(true);

        const { getByText } = await navigateToReadyStep();

        await act(async () => {
          fireEvent.press(getByText('intro_get_started'));
        });

        expect(mockSetSettingAsync).toHaveBeenCalledWith('weather_enabled', '1');
        expect(mockSetSettingAsync).toHaveBeenCalledWith('smart_reminders_count', '2');
      });

      it('does not enable weather when only weather location permission is granted', async () => {
        mockGetNotifPermissions.mockResolvedValue({ status: 'denied' });
        mockCheckGPS.mockResolvedValue(true);
        mockCheckWeather.mockResolvedValue(true);

        const { getByText } = await navigateToReadyStep();

        await act(async () => {
          fireEvent.press(getByText('intro_get_started'));
        });

        expect(mockSetSettingAsync).not.toHaveBeenCalledWith('weather_enabled', '1');
        expect(mockSetSettingAsync).not.toHaveBeenCalledWith('smart_reminders_count', '2');
      });

      it('does not enable smart reminders or weather when no permissions granted', async () => {
        mockGetNotifPermissions.mockResolvedValue({ status: 'denied' });
        mockCheckGPS.mockResolvedValue(false);
        mockCheckWeather.mockResolvedValue(false);

        const { getByText } = await navigateToReadyStep();

        await act(async () => {
          fireEvent.press(getByText('intro_get_started'));
        });

        expect(mockSetSettingAsync).not.toHaveBeenCalledWith('smart_reminders_count', '2');
        expect(mockSetSettingAsync).not.toHaveBeenCalledWith('weather_enabled', '1');
      });
    });
  });

  describe('Welcome step privacy policy link', () => {
    beforeEach(() => {
      jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    });

    it('renders privacy policy link on the welcome step', () => {
      const onComplete = jest.fn();
      const { getByText } = render(<IntroScreen onComplete={onComplete} />);

      expect(getByText('intro_privacy_policy')).toBeTruthy();
    });

    it('opens privacy policy URL when privacy policy link is pressed', async () => {
      const onComplete = jest.fn();
      const { getByText } = render(<IntroScreen onComplete={onComplete} />);

      fireEvent.press(getByText('intro_privacy_policy'));

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
      });
    });
  });
});
