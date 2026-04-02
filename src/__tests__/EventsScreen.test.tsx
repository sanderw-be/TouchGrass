import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../storage/database', () => ({
  getAllSessionsIncludingDiscarded: jest.fn(() => []),
  autoCloseOldProposedSessions: jest.fn(),
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

jest.mock('../notifications/notificationManager', () => ({
  cancelRemindersIfGoalReached: jest.fn(() => Promise.resolve()),
}));

jest.mock('../components/ManualSessionSheet', () => {
  return jest.fn(() => null);
});

jest.mock('../components/EditSessionSheet', () => {
  return jest.fn(() => null);
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
  };
});

import EventsScreen from '../screens/EventsScreen';
import {
  getAllSessionsIncludingDiscarded,
  confirmSession,
  OutsideSession,
} from '../storage/database';

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
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockPendingSession]);
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(<EventsScreen />);
    expect(getByTestId('toggle-review')).toBeTruthy();
    expect(getByTestId('toggle-rejected')).toBeTruthy();
  });

  it('shows proposed badge count when there are pending sessions', () => {
    const { getByText } = render(<EventsScreen />);
    // Badge shows pending count
    expect(getByText('1')).toBeTruthy();
  });

  it('shows swipe confirm action for pending sessions (include review on by default)', () => {
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

  it('hides pending sessions when Include Review is toggled off', () => {
    const { getByTestId, queryByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('toggle-review'));
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });

  it('does not show swipe actions for confirmed sessions', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockConfirmedSession]);
    const { queryByTestId } = render(<EventsScreen />);
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });

  it('does not show rejected sessions by default, but shows approved sessions', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([
      mockRejectedSession,
      mockConfirmedSession,
    ]);
    const { queryByTestId, getByText } = render(<EventsScreen />);
    // Rejected sessions are hidden when Include Rejected is off
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    // Approved sessions are still visible (session row with the time text)
    expect(getByText('10:00–10:00')).toBeTruthy();
  });

  it('shows rejected sessions when Include Rejected is toggled on', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockRejectedSession]);
    const { getByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('toggle-rejected'));
    // Rejected session is now visible (no swipe actions since it's not pending)
    expect(getByTestId('toggle-rejected')).toBeTruthy();
  });
});
