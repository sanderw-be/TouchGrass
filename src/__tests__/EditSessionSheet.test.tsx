import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../storage/database', () => ({
  updateSessionTimes: jest.fn(),
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${mins} min`,
}));

import EditSessionSheet from '../components/EditSessionSheet';
import { OutsideSession } from '../storage/database';

const mockSession: OutsideSession = {
  id: 42,
  startTime: new Date('2024-01-01T09:00:00.000Z').getTime(),
  endTime: new Date('2024-01-01T09:30:00.000Z').getTime(),
  durationMinutes: 30,
  source: 'gps',
  confidence: 0.8,
  userConfirmed: null,
  discarded: 0,
};

const defaultProps = {
  visible: true,
  session: mockSession,
  onClose: jest.fn(),
  onSessionUpdated: jest.fn(),
};

describe('EditSessionSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<EditSessionSheet {...defaultProps} />);
    expect(getByText('session_edit_title')).toBeTruthy();
  });

  it('shows the hint text', () => {
    const { getByText } = render(<EditSessionSheet {...defaultProps} />);
    expect(getByText('session_edit_hint')).toBeTruthy();
  });

  it('shows start and end time section labels', () => {
    const { getAllByText } = render(<EditSessionSheet {...defaultProps} />);
    expect(getAllByText('manual_start_time').length).toBeGreaterThan(0);
    expect(getAllByText('manual_end_time').length).toBeGreaterThan(0);
  });

  it('shows the save button', () => {
    const { getByText } = render(<EditSessionSheet {...defaultProps} />);
    expect(getByText('session_edit_save')).toBeTruthy();
  });

  it('calls updateSessionTimes and onSessionUpdated when save is pressed', () => {
    const { updateSessionTimes } = require('../storage/database');
    const onSessionUpdated = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <EditSessionSheet {...defaultProps} onSessionUpdated={onSessionUpdated} onClose={onClose} />
    );
    fireEvent.press(getByText('session_edit_save'));
    expect(updateSessionTimes).toHaveBeenCalledWith(
      mockSession.id,
      expect.any(Number),
      expect.any(Number)
    );
    expect(onSessionUpdated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an alert and does not save when duration is zero', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { updateSessionTimes } = require('../storage/database');
    const onSessionUpdated = jest.fn();

    const zeroSession: OutsideSession = {
      ...mockSession,
      startTime: new Date('2024-01-01T09:00:00.000Z').getTime(),
      endTime: new Date('2024-01-01T09:00:00.000Z').getTime(), // same as start
      durationMinutes: 0,
    };

    const { getByText } = render(
      <EditSessionSheet
        {...defaultProps}
        session={zeroSession}
        onSessionUpdated={onSessionUpdated}
      />
    );
    fireEvent.press(getByText('session_edit_save'));
    expect(alertSpy).toHaveBeenCalledWith('manual_invalid_title', 'manual_invalid_body');
    expect(updateSessionTimes).not.toHaveBeenCalled();
    expect(onSessionUpdated).not.toHaveBeenCalled();
  });

  it('shows an alert and does not save when duration exceeds 12 hours', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { updateSessionTimes } = require('../storage/database');
    const onSessionUpdated = jest.fn();

    const longSession: OutsideSession = {
      ...mockSession,
      startTime: new Date('2024-01-01T00:00:00.000Z').getTime(),
      endTime: new Date('2024-01-01T13:00:00.000Z').getTime(), // 13 hours — exceeds limit
      durationMinutes: 780,
    };

    const { getByText } = render(
      <EditSessionSheet
        {...defaultProps}
        session={longSession}
        onSessionUpdated={onSessionUpdated}
      />
    );
    fireEvent.press(getByText('session_edit_save'));
    expect(alertSpy).toHaveBeenCalledWith('manual_invalid_title', 'manual_invalid_body');
    expect(updateSessionTimes).not.toHaveBeenCalled();
    expect(onSessionUpdated).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<EditSessionSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<EditSessionSheet {...defaultProps} visible={false} />);
    expect(queryByText('session_edit_title')).toBeNull();
  });

  it('does not render when session is null', () => {
    const { queryByText } = render(<EditSessionSheet {...defaultProps} session={null} />);
    expect(queryByText('session_edit_title')).toBeNull();
  });
});
