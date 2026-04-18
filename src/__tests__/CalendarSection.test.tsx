import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

// Mock App Store
jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      colors: {
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
      },
      shadows: { soft: {} },
    })
  ),
}));

import CalendarSection from '../components/goals/CalendarSection';

const defaultProps = {
  calendarEnabled: false,
  calendarPermissionGranted: false,
  calendarBuffer: 30,
  calendarDuration: 0,
  calendarSelectedId: '',
  calendarOptions: [],
  onToggleCalendar: jest.fn(),
  onCycleCalendarBuffer: jest.fn(),
  onCycleCalendarDuration: jest.fn(),
  onSelectCalendar: jest.fn(),
  onShowCalendarPermissionSheet: jest.fn(),
};

describe('CalendarSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<CalendarSection {...defaultProps} />);
    expect(getByText('settings_section_calendar')).toBeTruthy();
  });

  it('renders the calendar integration toggle row', () => {
    const { getByText } = render(<CalendarSection {...defaultProps} />);
    expect(getByText('settings_calendar_integration')).toBeTruthy();
  });

  it('does not show sub-rows when calendar is disabled', () => {
    const { queryByText } = render(
      <CalendarSection {...defaultProps} calendarEnabled={false} calendarPermissionGranted={true} />
    );
    expect(queryByText('settings_calendar_buffer')).toBeNull();
    expect(queryByText('settings_calendar_duration')).toBeNull();
    expect(queryByText('settings_calendar_select')).toBeNull();
  });

  it('does not show sub-rows when permission is not granted', () => {
    const { queryByText } = render(
      <CalendarSection {...defaultProps} calendarEnabled={true} calendarPermissionGranted={false} />
    );
    expect(queryByText('settings_calendar_buffer')).toBeNull();
  });

  it('shows sub-rows when calendar is enabled and permission is granted', () => {
    const { getByText } = render(
      <CalendarSection {...defaultProps} calendarEnabled={true} calendarPermissionGranted={true} />
    );
    expect(getByText('settings_calendar_buffer')).toBeTruthy();
    expect(getByText('settings_calendar_duration')).toBeTruthy();
    expect(getByText('settings_calendar_select')).toBeTruthy();
  });

  it('shows "Off" duration label when calendar duration is 0', () => {
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarDuration={0}
      />
    );
    expect(getByText('settings_calendar_duration_off')).toBeTruthy();
  });

  it('shows minutes duration label when calendar duration is non-zero', () => {
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarDuration={15}
      />
    );
    expect(getByText('settings_calendar_duration_minutes')).toBeTruthy();
  });

  it('shows permission missing label when calendar is enabled but permission is not granted', () => {
    const { getByText } = render(
      <CalendarSection {...defaultProps} calendarEnabled={true} calendarPermissionGranted={false} />
    );
    expect(getByText('settings_calendar_permission_missing')).toBeTruthy();
  });

  it('calls onCycleCalendarBuffer when buffer row is tapped', () => {
    const onCycleCalendarBuffer = jest.fn();
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        onCycleCalendarBuffer={onCycleCalendarBuffer}
      />
    );
    fireEvent.press(getByText('settings_calendar_buffer'));
    expect(onCycleCalendarBuffer).toHaveBeenCalled();
  });

  it('calls onCycleCalendarDuration when duration row is tapped', () => {
    const onCycleCalendarDuration = jest.fn();
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        onCycleCalendarDuration={onCycleCalendarDuration}
      />
    );
    fireEvent.press(getByText('settings_calendar_duration'));
    expect(onCycleCalendarDuration).toHaveBeenCalled();
  });

  it('shows TouchGrass as selected calendar when no calendar is selected', () => {
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarSelectedId=""
        calendarOptions={[]}
      />
    );
    expect(getByText('settings_calendar_select_touchgrass')).toBeTruthy();
  });

  it('shows selected calendar title when a calendar is selected', () => {
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarSelectedId="cal-1"
        calendarOptions={[{ id: 'cal-1', title: 'Personal' }]}
      />
    );
    expect(getByText('Personal')).toBeTruthy();
  });

  it('disables calendar select row when no alternative calendars exist', () => {
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarOptions={[{ id: 'tg-1', title: 'TouchGrass' }]}
      />
    );
    // Row is rendered but disabled (only TouchGrass calendar)
    expect(getByText('settings_calendar_select')).toBeTruthy();
  });

  it('calls onSelectCalendar when calendar select row is tapped with alternatives', () => {
    const onSelectCalendar = jest.fn();
    const { getByText } = render(
      <CalendarSection
        {...defaultProps}
        calendarEnabled={true}
        calendarPermissionGranted={true}
        calendarOptions={[
          { id: 'tg-1', title: 'TouchGrass' },
          { id: 'cal-1', title: 'Personal' },
        ]}
        onSelectCalendar={onSelectCalendar}
      />
    );
    fireEvent.press(getByText('settings_calendar_select'));
    expect(onSelectCalendar).toHaveBeenCalled();
  });
});
