import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../../App';

// Mock the navigation module
jest.mock('../navigation/AppNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => <Text>AppNavigator</Text>;
});

// Mock IntroScreen
jest.mock('../screens/IntroScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ onComplete }: { onComplete: () => void }) => <Text>IntroScreen</Text>;
});

// Mock the i18n module
jest.mock('../i18n', () => ({
  locale: 'en',
}));

// Mock detection module
jest.mock('../detection/index', () => ({
  initDetection: jest.fn().mockResolvedValue(undefined),
}));

// Mock notification manager
jest.mock('../notifications/notificationManager', () => ({
  setupNotificationInfrastructure: jest.fn().mockResolvedValue(undefined),
  scheduleDayReminders: jest.fn().mockResolvedValue(undefined),
}));

// Mock scheduled notifications
jest.mock('../notifications/scheduledNotifications', () => ({
  scheduleAllScheduledNotifications: jest.fn().mockResolvedValue(undefined),
}));

// Mock weather background task
jest.mock('../weather/weatherBackgroundTask', () => ({
  registerWeatherBackgroundFetch: jest.fn().mockResolvedValue(undefined),
}));

// Mock database module
jest.mock('../storage/database', () => ({
  initDatabase: jest.fn(),
  getSetting: jest.fn((key: string, fallback: string) => {
    if (key === 'hasCompletedIntro') return '1';
    if (key === 'language') return 'en';
    return fallback;
  }),
  setSetting: jest.fn(),
}));

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

describe('App', () => {
  it('renders loading state initially', () => {
    const { getByTestId, UNSAFE_queryByType } = render(<App />);
    
    // ActivityIndicator should be present initially
    const activityIndicator = UNSAFE_queryByType('ActivityIndicator' as any);
    expect(activityIndicator).toBeTruthy();
  });

  it('initializes the database on mount', async () => {
    const { initDatabase } = require('../storage/database');
    
    render(<App />);
    
    await waitFor(() => {
      expect(initDatabase).toHaveBeenCalled();
    });
  });

  it('renders AppNavigator after initialization when intro is completed', async () => {
    const { getByText } = render(<App />);
    
    await waitFor(() => {
      expect(getByText('AppNavigator')).toBeTruthy();
    }, { timeout: 3000 });
  });
});
