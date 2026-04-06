import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  formatLocalDate: () => 'Mon, Jan 1',
  formatLocalTime: () => '10:00',
}));

jest.mock('../storage/database', () => ({
  getAllSessionsIncludingDiscardedAsync: jest.fn(() => Promise.resolve([])),
  autoCloseOldProposedSessionsAsync: jest.fn(() => Promise.resolve(0)),
  confirmSessionAsync: jest.fn(() => Promise.resolve()),
  deleteSessionAsync: jest.fn(() => Promise.resolve()),
  unDiscardSessionAsync: jest.fn(() => Promise.resolve()),
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

jest.mock('../utils/widgetHelper', () => ({
  requestWidgetRefresh: jest.fn(() => Promise.resolve()),
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
  getAllSessionsIncludingDiscardedAsync,
  autoCloseOldProposedSessionsAsync,
  confirmSessionAsync,
  OutsideSession,
} from '../storage/database';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { requestWidgetRefresh } from '../utils/widgetHelper';

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
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockPendingSession]);
  });

  it('renders without crashing with all three toggles', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    expect(getByTestId('toggle-confirmed')).toBeTruthy();
    expect(getByTestId('toggle-review')).toBeTruthy();
    expect(getByTestId('toggle-rejected')).toBeTruthy();
  });

  it('calls autoCloseOldProposedSessionsAsync on load', async () => {
    render(<EventsScreen />);
    await act(async () => {});
    expect(autoCloseOldProposedSessionsAsync).toHaveBeenCalled();
  });

  it('shows pending sessions by default (includeReview = true)', async () => {
    const { getByText } = render(<EventsScreen />);
    await act(async () => {});
    // The pending session is visible because includeReview is enabled by default
    expect(getByText('10:00–10:00')).toBeTruthy();
  });

  it('shows confirmed sessions by default (includeConfirmed = true)', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockConfirmedSession]);
    const { getByText } = render(<EventsScreen />);
    await act(async () => {});
    expect(getByText('10:00–10:00')).toBeTruthy();
  });

  it('hides confirmed sessions when Confirmed toggle is turned off', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockConfirmedSession]);
    const { getByTestId, queryByText } = render(<EventsScreen />);
    await act(async () => {});
    fireEvent.press(getByTestId('toggle-confirmed'));
    expect(queryByText('10:00–10:00')).toBeNull();
  });

  it('shows swipe confirm action for pending sessions', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    expect(getByTestId('swipe-confirm-action')).toBeTruthy();
    expect(getByTestId('swipe-reject-action')).toBeTruthy();
  });

  it('shows a swipe hint for pending sessions', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    expect(getByTestId('session-swipe-hint')).toBeTruthy();
  });

  it('calls confirmSessionAsync(true) when swipe confirm action is tapped', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-confirm-action'));
    });
    expect(confirmSessionAsync).toHaveBeenCalledWith(1, true);
  });

  it('calls confirmSessionAsync(false) when swipe reject action is tapped', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-reject-action'));
    });
    expect(confirmSessionAsync).toHaveBeenCalledWith(1, false);
  });

  it('emits session change after swipe confirm so the nav badge updates', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-confirm-action'));
    });
    expect(emitSessionsChanged).toHaveBeenCalled();
  });

  it('emits session change after swipe reject so the nav badge updates', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-reject-action'));
    });
    expect(emitSessionsChanged).toHaveBeenCalled();
  });

  it('shows undo snackbar after swipe reject action', async () => {
    const { getByTestId, queryByTestId } = render(<EventsScreen />);
    await act(async () => {});
    expect(queryByTestId('undo-snackbar')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('swipe-reject-action'));
    });
    expect(getByTestId('undo-snackbar')).toBeTruthy();
  });

  it('calls confirmSessionAsync(id, null) when undo button is pressed after reject', async () => {
    const { getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-reject-action'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('undo-snackbar-button'));
    });
    expect(confirmSessionAsync).toHaveBeenCalledWith(1, null);
  });

  it('hides undo snackbar after undo button is pressed', async () => {
    const { getByTestId, queryByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-reject-action'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('undo-snackbar-button'));
    });
    expect(queryByTestId('undo-snackbar')).toBeNull();
  });

  it('does not show undo snackbar after swipe confirm action', async () => {
    const { getByTestId, queryByTestId } = render(<EventsScreen />);
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByTestId('swipe-confirm-action'));
    });
    expect(queryByTestId('undo-snackbar')).toBeNull();
  });

  it('does not show swipe actions for confirmed sessions', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockConfirmedSession]);
    const { queryByTestId } = render(<EventsScreen />);
    await act(async () => {});
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
    expect(queryByTestId('session-swipe-hint')).toBeNull();
  });

  it('hides rejected sessions by default (includeRejected = false)', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockRejectedSession]);
    const { queryByText } = render(<EventsScreen />);
    await act(async () => {});
    // Rejected sessions are hidden by default; only approved/in-review are shown
    expect(queryByText('10:00–10:00')).toBeNull();
  });

  it('shows rejected sessions after toggling includeRejected on', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([
      mockConfirmedSession,
      mockRejectedSession,
    ]);
    const { getByTestId, getAllByText } = render(<EventsScreen />);
    await act(async () => {});
    // Toggle "Rejected" on
    fireEvent.press(getByTestId('toggle-rejected'));
    // Both sessions should now be visible (they share the same time mock)
    expect(getAllByText('10:00–10:00').length).toBeGreaterThanOrEqual(2);
  });

  it('does not show swipe actions for rejected sessions', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockRejectedSession]);
    const { queryByTestId, getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    // Toggle rejected on to make the session visible
    fireEvent.press(getByTestId('toggle-rejected'));
    expect(queryByTestId('swipe-confirm-action')).toBeNull();
    expect(queryByTestId('swipe-reject-action')).toBeNull();
    expect(queryByTestId('session-swipe-hint')).toBeNull();
  });

  it('calls requestWidgetRefresh when Review Again is tapped on a confirmed session', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockConfirmedSession]);
    const { getByText, getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    // Expand the confirmed session row
    fireEvent.press(getByText('10:00–10:00'));
    // Tap "Review Again"
    await act(async () => {
      fireEvent.press(getByTestId('review-again-action'));
    });
    expect(requestWidgetRefresh).toHaveBeenCalled();
  });

  it('calls confirmSessionAsync(id, null) when Review Again is tapped on a confirmed session', async () => {
    (getAllSessionsIncludingDiscardedAsync as jest.Mock).mockResolvedValue([mockConfirmedSession]);
    const { getByText, getByTestId } = render(<EventsScreen />);
    await act(async () => {});
    // Expand the confirmed session row
    fireEvent.press(getByText('10:00–10:00'));
    // Tap "Review Again"
    await act(async () => {
      fireEvent.press(getByTestId('review-again-action'));
    });
    expect(confirmSessionAsync).toHaveBeenCalledWith(mockConfirmedSession.id, null);
  });
});
