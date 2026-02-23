import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import IntroScreen from '../screens/IntroScreen';

// Mock the i18n module
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Mock detection module
jest.mock('../detection/index', () => ({
  requestHealthConnect: jest.fn(),
  recheckHealthConnect: jest.fn(() => Promise.resolve(false)),
  requestGPSPermissions: jest.fn(),
  checkGPSPermissions: jest.fn(() => Promise.resolve(false)),
}));

// Mock notification manager
jest.mock('../notifications/notificationManager', () => ({
  requestNotificationPermissions: jest.fn(),
}));

// Mock calendar service
const mockRequestCalendarPermissions = jest.fn(() => Promise.resolve(false));
const mockHasCalendarPermissions = jest.fn(() => Promise.resolve(false));
jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: () => mockRequestCalendarPermissions(),
  hasCalendarPermissions: () => mockHasCalendarPermissions(),
}));

// Mock database
const mockGetSetting = jest.fn((key: string, fallback: string) => fallback);
const mockSetSetting = jest.fn();
jest.mock('../storage/database', () => ({
  getSetting: (key: string, fallback: string) => mockGetSetting(key, fallback),
  setSetting: (key: string, value: string) => mockSetSetting(key, value),
}));

describe('IntroScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, fallback: string) => fallback);
    mockHasCalendarPermissions.mockResolvedValue(false);
    mockRequestCalendarPermissions.mockResolvedValue(false);
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
    expect(getByText('intro_hc_title')).toBeTruthy();

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

    it('calls requestCalendarPermissions and enables integration when connect button is pressed', async () => {
      mockRequestCalendarPermissions.mockResolvedValueOnce(true);
      const { getByText } = await navigateToCalendarStep();

      await act(async () => {
        fireEvent.press(getByText('intro_calendar_button'));
      });

      expect(mockRequestCalendarPermissions).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockSetSetting).toHaveBeenCalledWith('calendar_integration_enabled', '1');
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
      mockGetSetting.mockImplementation((key: string, fallback: string) => {
        if (key === 'calendar_integration_enabled') return '0';
        return fallback;
      });

      await navigateToCalendarStep();

      await waitFor(() => {
        expect(mockSetSetting).toHaveBeenCalledWith('calendar_integration_enabled', '1');
      });
    });

    it('cycles the calendar buffer when tapped', async () => {
      const { getByText } = await navigateToCalendarStep();

      const bufferRow = getByText('intro_calendar_buffer_label');
      await act(async () => {
        fireEvent.press(bufferRow);
      });

      expect(mockSetSetting).toHaveBeenCalledWith(
        'calendar_buffer_minutes',
        expect.any(String),
      );
    });

    it('cycles the calendar duration when tapped', async () => {
      const { getByText } = await navigateToCalendarStep();

      const durationRow = getByText('intro_calendar_duration_label');
      await act(async () => {
        fireEvent.press(durationRow);
      });

      expect(mockSetSetting).toHaveBeenCalledWith(
        'calendar_default_duration',
        expect.any(String),
      );
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

      fireEvent.press(getByText('intro_get_started'));

      expect(onComplete).toHaveBeenCalled();
    });
  });
});
