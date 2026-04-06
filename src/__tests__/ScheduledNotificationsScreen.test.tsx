import React from 'react';
import { render } from '@testing-library/react-native';

// Mock database BEFORE importing the component
const mockGetScheduledNotificationsAsync = jest.fn(() => Promise.resolve([]));
jest.mock('../storage/database', () => ({
  getScheduledNotificationsAsync: mockGetScheduledNotificationsAsync,
  insertScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  updateScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  deleteScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  toggleScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

// Mock navigation - do not call the callback to avoid infinite loops
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: jest.fn(),
  };
});

// Mock scheduledNotifications
jest.mock('../notifications/scheduledNotifications', () => ({
  scheduleAllScheduledNotifications: jest.fn(() => Promise.resolve()),
}));

// Import component AFTER mocks
import ScheduledNotificationsScreen from '../screens/ScheduledNotificationsScreen';

describe('ScheduledNotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('renders add button', () => {
    const { getByText } = render(<ScheduledNotificationsScreen />);
    expect(getByText(/Add reminder/i)).toBeTruthy();
  });

  it('renders empty state when no schedules exist', () => {
    const { getByText } = render(<ScheduledNotificationsScreen />);
    expect(getByText(/No scheduled reminders yet/i)).toBeTruthy();
  });

  it('can be rendered without errors', () => {
    const component = render(<ScheduledNotificationsScreen />);
    expect(component).toBeTruthy();
  });
});
