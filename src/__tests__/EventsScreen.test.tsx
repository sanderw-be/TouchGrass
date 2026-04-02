import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../storage/database', () => ({
  getAllSessionsIncludingDiscarded: jest.fn(() => []),
  autoCloseOldProposedSessions: jest.fn(() => 0),
  confirmSession: jest.fn(),
  deleteSession: jest.fn(),
  unDiscardSession: jest.fn(),
}));

jest.mock('../utils/sessionsChangedEmitter', () => ({
  onSessionsChanged: jest.fn(() => () => {}),
  emitSessionsChanged: jest.fn(),
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
  autoCloseOldProposedSessions,
  confirmSession,
  OutsideSession,
} from '../storage/database';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';

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

  it('renders without crashing with all three toggles', () => {
    const { getByTestId } = render(<EventsScreen />);
    expect(getByTestId('toggle-confirmed')).toBeTruthy();
    expect(getByTestId('toggle-review')).toBeTruthy();
    expect(getByTestId('toggle-rejected')).toBeTruthy();
  });

  it('calls autoCloseOldProposedSessions on load', () => {
    render(<EventsScreen />);
    expect(autoCloseOldProposedSessions).toHaveBeenCalled();
  });

  it('shows pending sessions by default (includeReview = true)', () => {
    const { getByText } = render(<EventsScreen />);
    // The pending session is visible because includeReview is enabled by default
    expect(getByText('10:00–10:00')).toBeTruthy();
  });

  it('shows confirmed sessions by default (includeConfirmed = true)', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockConfirmedSession]);
    const { getByText } = render(<EventsScreen />);
    expect(getByText('10:00–10:00')).toBeTruthy();
  });

  it('hides confirmed sessions when Confirmed toggle is turned off', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockConfirmedSession]);
    const { getByTestId, queryByText } = render(<EventsScreen />);
    fireEvent.press(getByTestId('toggle-confirmed'));
    expect(queryByText('10:00–10:00')).toBeNull();
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

  it('emits session change after swipe confirm so the nav badge updates', () => {
    const { getByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('swipe-confirm-action'));
    expect(emitSessionsChanged).toHaveBeenCalled();
  });

  it('emits session change after swipe reject so the nav badge updates', () => {
    const { getByTestId } = render(<EventsScreen />);
    fireEvent.press(getByTestId('swipe-reject-action'));
    expect(emitSessionsChanged).toHaveBeenCalled();
  });

  it('does not show swipe actions for confirmed sessions', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockConfirmedSession]);
    const { queryByTestId } = render(<EventsScreen />);
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });

  it('hides rejected sessions by default (includeRejected = false)', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockRejectedSession]);
    const { queryByText } = render(<EventsScreen />);
    // Rejected sessions are hidden by default; only approved/in-review are shown
    expect(queryByText('10:00–10:00')).toBeNull();
  });

  it('shows rejected sessions after toggling includeRejected on', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([
      mockConfirmedSession,
      mockRejectedSession,
    ]);
    const { getByTestId, getAllByText } = render(<EventsScreen />);
    // Toggle "Rejected" on
    fireEvent.press(getByTestId('toggle-rejected'));
    // Both sessions should now be visible (they share the same time mock)
    expect(getAllByText('10:00–10:00').length).toBeGreaterThanOrEqual(2);
  });

  it('does not show swipe actions for rejected sessions', () => {
    (getAllSessionsIncludingDiscarded as jest.Mock).mockReturnValue([mockRejectedSession]);
    const { queryByTestId, getByTestId } = render(<EventsScreen />);
    // Toggle rejected on to make the session visible
    fireEvent.press(getByTestId('toggle-rejected'));
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
  });
});
