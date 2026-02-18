import React from 'react';
import { render } from '@testing-library/react-native';

// Mock database BEFORE importing the component
const mockGetScheduledNotifications = jest.fn(() => []);
jest.mock('../storage/database', () => ({
  getScheduledNotifications: mockGetScheduledNotifications,
  insertScheduledNotification: jest.fn(),
  updateScheduledNotification: jest.fn(),
  deleteScheduledNotification: jest.fn(),
  toggleScheduledNotification: jest.fn(),
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
    mockGetScheduledNotifications.mockReturnValue([]);
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
