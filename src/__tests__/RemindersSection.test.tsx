import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';

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

import RemindersSection from '../components/goals/RemindersSection';

const defaultProps = {
  smartRemindersCount: 2,
  catchupRemindersCount: 2,
  notificationPermissionGranted: true,
  batteryOptimizationGranted: false,
  onCycleSmartReminders: jest.fn(),
  onCycleCatchupReminders: jest.fn(),
  onNavigateScheduledNotifications: jest.fn(),
  onShowNotificationPermissionSheet: jest.fn(),
  onShowBatteryPermissionSheet: jest.fn(),
};

describe('RemindersSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<RemindersSection {...defaultProps} />);
    expect(getByText('settings_section_reminders')).toBeTruthy();
  });

  it('renders the smart reminders row', () => {
    const { getByText } = render(<RemindersSection {...defaultProps} />);
    expect(getByText('settings_reminders_label')).toBeTruthy();
  });

  it('renders the catch-up reminders row', () => {
    const { getByText } = render(<RemindersSection {...defaultProps} />);
    expect(getByText('settings_catchup_label')).toBeTruthy();
  });

  it('renders the scheduled reminders row', () => {
    const { getByText } = render(<RemindersSection {...defaultProps} />);
    expect(getByText('settings_scheduled_reminders')).toBeTruthy();
  });

  it('renders the background tracking row', () => {
    const { getByText } = render(<RemindersSection {...defaultProps} />);
    expect(getByText('settings_background_tracking_label')).toBeTruthy();
  });

  it('shows notification permission missing when smart reminders count > 0 and permission denied', () => {
    const { getByText } = render(
      <RemindersSection
        {...defaultProps}
        smartRemindersCount={2}
        notificationPermissionGranted={false}
      />
    );
    expect(getByText('settings_notification_permission_missing')).toBeTruthy();
  });

  it('does not show permission missing when smart reminders count is 0', () => {
    const { queryByText } = render(
      <RemindersSection
        {...defaultProps}
        smartRemindersCount={0}
        notificationPermissionGranted={false}
      />
    );
    expect(queryByText('settings_notification_permission_missing')).toBeNull();
  });

  it('calls onCycleSmartReminders when smart reminders row is tapped (permission granted)', () => {
    const onCycleSmartReminders = jest.fn();
    const { getByTestId } = render(
      <RemindersSection
        {...defaultProps}
        notificationPermissionGranted={true}
        onCycleSmartReminders={onCycleSmartReminders}
      />
    );
    fireEvent.press(getByTestId('smart-reminders-row'));
    expect(onCycleSmartReminders).toHaveBeenCalled();
  });

  it('calls onShowNotificationPermissionSheet when smart reminders row is tapped with count > 0 and permission denied', () => {
    const onShowNotificationPermissionSheet = jest.fn();
    const { getByTestId } = render(
      <RemindersSection
        {...defaultProps}
        smartRemindersCount={2}
        notificationPermissionGranted={false}
        onShowNotificationPermissionSheet={onShowNotificationPermissionSheet}
      />
    );
    fireEvent.press(getByTestId('smart-reminders-row'));
    expect(onShowNotificationPermissionSheet).toHaveBeenCalled();
  });

  it('calls onCycleCatchupReminders when catch-up row is tapped', () => {
    const onCycleCatchupReminders = jest.fn();
    const { getByText } = render(
      <RemindersSection {...defaultProps} onCycleCatchupReminders={onCycleCatchupReminders} />
    );
    fireEvent.press(getByText('settings_catchup_label'));
    expect(onCycleCatchupReminders).toHaveBeenCalled();
  });

  it('calls onNavigateScheduledNotifications when scheduled reminders row is tapped', () => {
    const onNavigateScheduledNotifications = jest.fn();
    const { getByText } = render(
      <RemindersSection
        {...defaultProps}
        onNavigateScheduledNotifications={onNavigateScheduledNotifications}
      />
    );
    fireEvent.press(getByText('settings_scheduled_reminders'));
    expect(onNavigateScheduledNotifications).toHaveBeenCalled();
  });

  describe('battery optimization row (Android)', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('shows battery optimization row on Android', () => {
      (Platform as any).OS = 'android';
      const { getByText } = render(<RemindersSection {...defaultProps} />);
      expect(getByText('settings_battery_optimization')).toBeTruthy();
    });

    it('does not show battery optimization row on iOS', () => {
      (Platform as any).OS = 'ios';
      const { queryByText } = render(<RemindersSection {...defaultProps} />);
      expect(queryByText('settings_battery_optimization')).toBeNull();
    });

    it('calls onShowBatteryPermissionSheet when battery row is tapped', () => {
      (Platform as any).OS = 'android';
      const onShowBatteryPermissionSheet = jest.fn();
      const { getByTestId } = render(
        <RemindersSection
          {...defaultProps}
          batteryOptimizationGranted={false}
          onShowBatteryPermissionSheet={onShowBatteryPermissionSheet}
        />
      );
      fireEvent.press(getByTestId('battery-optimization-row'));
      expect(onShowBatteryPermissionSheet).toHaveBeenCalled();
    });

    it('disables battery row when optimization is already granted', () => {
      (Platform as any).OS = 'android';
      const { getByTestId } = render(
        <RemindersSection {...defaultProps} batteryOptimizationGranted={true} />
      );
      expect(getByTestId('battery-optimization-row').props.accessibilityState?.disabled).toBe(true);
    });
  });
});
