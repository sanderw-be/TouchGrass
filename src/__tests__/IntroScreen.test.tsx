import React from 'react';
import { render } from '@testing-library/react-native';
import IntroScreen from '../screens/IntroScreen';

// Mock the i18n module
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Mock detection module
jest.mock('../detection/index', () => ({
  requestHealthConnect: jest.fn(),
  recheckHealthConnect: jest.fn(),
  requestGPSPermissions: jest.fn(),
  checkGPSPermissions: jest.fn(),
}));

// Mock notification manager
jest.mock('../notifications/notificationManager', () => ({
  requestNotificationPermissions: jest.fn(),
}));

// Mock calendar service
jest.mock('../calendar/calendarService', () => ({
  requestCalendarPermissions: jest.fn(),
  hasCalendarPermissions: jest.fn(() => Promise.resolve(false)),
}));

// Mock database
jest.mock('../storage/database', () => ({
  getSetting: jest.fn((key: string, fallback: string) => fallback),
  setSetting: jest.fn(),
}));

describe('IntroScreen', () => {
  it('renders without crashing', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);
    
    // Check that the welcome step is shown
    expect(getByText('intro_welcome_title')).toBeTruthy();
  });

  it('renders progress bar', () => {
    const onComplete = jest.fn();
    const { UNSAFE_getAllByType } = render(<IntroScreen onComplete={onComplete} />);
    
    // Check that the component tree contains View elements (progress bar)
    // This is a basic smoke test to ensure the component structure is intact
    const views = UNSAFE_getAllByType('View' as any);
    expect(views.length).toBeGreaterThan(0);
  });

  it('renders Next button', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);
    
    expect(getByText('intro_next')).toBeTruthy();
  });

  it('renders Skip button', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);
    
    expect(getByText('intro_skip')).toBeTruthy();
  });
});
