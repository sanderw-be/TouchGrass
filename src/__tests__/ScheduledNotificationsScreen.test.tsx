import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// Mock database BEFORE importing the component
const mockGetScheduledNotificationsAsync = jest.fn(() => Promise.resolve([]));
jest.mock('../storage', () => ({
  getScheduledNotificationsAsync: mockGetScheduledNotificationsAsync,
  insertScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  updateScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  deleteScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  toggleScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

// Mock navigation - invoke the focus callback so loadSchedules runs
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      setOptions: jest.fn(),
    }),
  };
});

// Mock notificationManager
jest.mock('../notifications/notificationManager', () => ({
  scheduledNotificationManager: {
    scheduleAllScheduledNotifications: jest.fn(() => Promise.resolve()),
  },
}));

// Import component AFTER mocks
import ScheduledNotificationsScreen from '../screens/ScheduledNotificationsScreen';

describe('ScheduledNotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('renders add button', async () => {
    const { getByText } = render(<ScheduledNotificationsScreen />);
    await act(async () => {});
    expect(getByText(/Add reminder/i)).toBeTruthy();
  });

  it('renders empty state when no schedules exist', async () => {
    const { getByText } = render(<ScheduledNotificationsScreen />);
    await act(async () => {});
    await waitFor(() => {
      expect(getByText(/No scheduled reminders yet/i)).toBeTruthy();
    });
  });

  it('can be rendered without errors', async () => {
    const component = render(<ScheduledNotificationsScreen />);
    await act(async () => {});
    expect(component).toBeTruthy();
  });
});
