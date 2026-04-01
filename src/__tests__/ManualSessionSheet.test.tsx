import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mocks must be declared before the component import
jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Monday, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../detection/manualCheckin', () => ({
  logManualSession: jest.fn(),
  startManualSession: jest.fn(() => jest.fn()),
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${mins} min`,
  formatTimer: (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
}));

// Import component AFTER mocks
import ManualSessionSheet from '../components/ManualSessionSheet';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onSessionLogged: jest.fn(),
};

describe('ManualSessionSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<ManualSessionSheet {...defaultProps} />);
    expect(getByText('manual_title')).toBeTruthy();
  });

  it('shows log tab content by default', () => {
    const { getByText } = render(<ManualSessionSheet {...defaultProps} />);
    expect(getByText('manual_log_btn')).toBeTruthy();
  });

  it('shows timer tab content when timer tab is selected', () => {
    const { getByText } = render(<ManualSessionSheet {...defaultProps} />);
    fireEvent.press(getByText('manual_tab_timer'));
    expect(getByText('manual_timer_start')).toBeTruthy();
  });

  it('shows cancel and stop buttons while timer is running', () => {
    const { getByText } = render(<ManualSessionSheet {...defaultProps} />);
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    expect(getByText('manual_timer_cancel')).toBeTruthy();
    expect(getByText('manual_timer_stop')).toBeTruthy();
  });

  it('switches to log tab with hint when timer is stopped', () => {
    const { getByText } = render(<ManualSessionSheet {...defaultProps} />);
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    jest.setSystemTime(new Date('2024-01-01T10:10:00.000Z'));
    fireEvent.press(getByText('manual_timer_stop'));
    // Should show log tab
    expect(getByText('manual_log_btn')).toBeTruthy();
    // Should show contextual hint
    expect(getByText('manual_timer_stopped_hint')).toBeTruthy();
  });

  it('does not save the session immediately when the timer is stopped', () => {
    const { logManualSession } = require('../detection/manualCheckin');
    const onSessionLogged = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <ManualSessionSheet visible={true} onClose={onClose} onSessionLogged={onSessionLogged} />
    );
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    jest.setSystemTime(new Date('2024-01-01T10:10:00.000Z'));
    fireEvent.press(getByText('manual_timer_stop'));
    expect(logManualSession).not.toHaveBeenCalled();
    expect(onSessionLogged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('saves the session and closes when log button is pressed after stopping the timer', () => {
    const { logManualSession } = require('../detection/manualCheckin');
    const onSessionLogged = jest.fn();
    const onClose = jest.fn();
    const startMs = new Date('2024-01-01T10:00:00.000Z').getTime();
    const endMs = new Date('2024-01-01T10:10:00.000Z').getTime();
    const { getByText } = render(
      <ManualSessionSheet visible={true} onClose={onClose} onSessionLogged={onSessionLogged} />
    );
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    // Advance 10 minutes so the duration is valid
    jest.setSystemTime(new Date(endMs));
    fireEvent.press(getByText('manual_timer_stop'));
    fireEvent.press(getByText('manual_log_btn'));
    // Exact start and end timestamps are passed (not a rounded duration)
    expect(logManualSession).toHaveBeenCalledWith((endMs - startMs) / 60000, startMs, endMs);
    expect(onSessionLogged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a short timer session (under 1 minute) without showing an error', () => {
    const { logManualSession } = require('../detection/manualCheckin');
    const onSessionLogged = jest.fn();
    const onClose = jest.fn();
    const startMs = new Date('2024-01-01T10:00:00.000Z').getTime();
    const endMs = new Date('2024-01-01T10:00:20.000Z').getTime(); // 20 seconds
    const { getByText } = render(
      <ManualSessionSheet visible={true} onClose={onClose} onSessionLogged={onSessionLogged} />
    );
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    jest.setSystemTime(new Date(endMs));
    fireEvent.press(getByText('manual_timer_stop'));
    fireEvent.press(getByText('manual_log_btn'));
    expect(logManualSession).toHaveBeenCalledWith((endMs - startMs) / 60000, startMs, endMs);
    expect(onSessionLogged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays on the timer tab when cancel is pressed', () => {
    const { getByText, queryByText } = render(<ManualSessionSheet {...defaultProps} />);
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    fireEvent.press(getByText('manual_timer_cancel'));
    // Start button should be visible again (timer stopped, still on timer tab)
    expect(getByText('manual_timer_start')).toBeTruthy();
    // Log button should not be visible
    expect(queryByText('manual_log_btn')).toBeNull();
  });

  it('does not show the timer hint on the initial log tab', () => {
    const { queryByText } = render(<ManualSessionSheet {...defaultProps} />);
    expect(queryByText('manual_timer_stopped_hint')).toBeNull();
  });

  it('clears the hint when switching back to the timer tab', () => {
    const { getByText, queryByText } = render(<ManualSessionSheet {...defaultProps} />);
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_timer_start'));
    jest.setSystemTime(new Date('2024-01-01T10:10:00.000Z'));
    fireEvent.press(getByText('manual_timer_stop'));
    // Hint should be visible now
    expect(getByText('manual_timer_stopped_hint')).toBeTruthy();
    // Switch back to timer tab, then back to log tab
    fireEvent.press(getByText('manual_tab_timer'));
    fireEvent.press(getByText('manual_tab_log'));
    // Hint should be gone
    expect(queryByText('manual_timer_stopped_hint')).toBeNull();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <ManualSessionSheet visible={false} onClose={jest.fn()} onSessionLogged={jest.fn()} />
    );
    expect(queryByText('manual_title')).toBeNull();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ManualSessionSheet visible={true} onClose={onClose} onSessionLogged={jest.fn()} />
    );
    fireEvent.press(getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });
});
