import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../storage/database', () => ({
  getApprovedSessions: jest.fn(() => []),
  getStandardSessions: jest.fn(() => []),
  getAllSessionsIncludingDiscarded: jest.fn(() => []),
  confirmSession: jest.fn(),
  deleteSession: jest.fn(),
  unDiscardSession: jest.fn(),
}));

jest.mock('../utils/helpers', () => ({
  formatMinutes: (mins: number) => `${mins} min`,
}));

jest.mock('../detection/sessionConfidence', () => ({
  updateTimeSlotProbability: jest.fn(),
}));

jest.mock('../components/ManualSessionSheet', () => {
  const React = require('react');
  return jest.fn(() => null);
});

jest.mock('../components/EditSessionSheet', () => {
  const React = require('react');
  return jest.fn(() => null);
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => { React.useEffect(cb, []); },
  };
});

import EventsScreen from '../screens/EventsScreen';
import { getStandardSessions, confirmSession } from '../storage/database';
import { OutsideSession } from '../storage/database';

const mockPendingSession: OutsideSession = {
  id: 1,
  startTime: new Date('2024-01-01T09:00:00.000Z').getTime(),
  endTime: new Date('2024-01-01T09:30:00.000Z').getTime(),
  durationMinutes: 30,
  source: 'gps',
  confidence: 0.8,
  userConfirmed: null,
  discarded: 0,
};

const mockConfirmedSession: OutsideSession = {
  ...mockPendingSession,
  id: 2,
  userConfirmed: 1,
};

const mockRejectedSession: OutsideSession = {
  ...mockPendingSession,
  id: 3,
  userConfirmed: 0,
};

describe('EventsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getStandardSessions as jest.Mock).mockReturnValue([mockPendingSession]);
  });

  it('renders without crashing', () => {
    const { getByText } = render(<EventsScreen />);
    expect(getByText('events_tab_standard (1)')).toBeTruthy();
  });

  it('shows swipe confirm action for pending sessions', () => {
    const { getByTestId } = render(<EventsScreen />);
    expect(getByTestId('swipe-confirm-action')).toBeTruthy();
    expect(getByTestId('swipe-reject-action')).toBeTruthy();
  });

  it('calls confirmSession(true) when swipe confirm action is tapped', () => {
    const { getByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('swipe-confirm-action'));
    expect(confirmSession).toHaveBeenCalledWith(1, true);
  });

  it('calls confirmSession(false) when swipe reject action is tapped', () => {
    const { getByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('swipe-reject-action'));
    expect(confirmSession).toHaveBeenCalledWith(1, false);
  });

  it('does not show swipe actions for confirmed sessions', () => {
    (getStandardSessions as jest.Mock).mockReturnValue([mockConfirmedSession]);
    const { queryByTestId } = render(<EventsScreen />);
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });

  it('does not show swipe actions for rejected sessions', () => {
    (getStandardSessions as jest.Mock).mockReturnValue([mockRejectedSession]);
    const { queryByTestId } = render(<EventsScreen />);
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });
});
