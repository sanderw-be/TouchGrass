import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { useAppInitialization } from '../hooks/useAppInitialization';
import { useOTAUpdates } from '../hooks/useOTAUpdates';

// Mock hooks
jest.mock('../hooks/useAppInitialization');
jest.mock('../hooks/useOTAUpdates');
jest.mock('expo-font');
jest.mock('expo-battery');

// Mock components that are complex or have side effects
jest.mock('../navigation/AppNavigator', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockAppNavigator = () => <View testID="app-navigator" />;
  return MockAppNavigator;
});
jest.mock('../screens/IntroScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIntroScreen = () => <View testID="intro-screen" />;
  return MockIntroScreen;
});
jest.mock('../components/UpdateSplashScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockUpdateSplashScreen = () => <View testID="update-splash-screen" />;
  return MockUpdateSplashScreen;
});
jest.mock('react-native/Libraries/Components/ActivityIndicator/ActivityIndicator', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockActivityIndicator = (props: any) => <View {...props} testID="activity-indicator" />;
  return { default: MockActivityIndicator };
});

const mockUseAppInitialization = useAppInitialization as jest.Mock;
const mockUseOTAUpdates = useOTAUpdates as jest.Mock;
const mockUseFonts = require('expo-font').useFonts as jest.Mock;

describe('<App />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFonts.mockReturnValue([true]);
    mockUseOTAUpdates.mockReturnValue({ updateStatus: 'ready' });
    mockUseAppInitialization.mockReturnValue({
      isReady: true,
      showIntro: false,
      locale: 'en',
      setLocale: jest.fn(),
      handleShowIntro: jest.fn(),
      handleIntroComplete: jest.fn(),
    });
  });

  it('renders font loading indicator if fonts are not loaded', () => {
    mockUseFonts.mockReturnValue([false]);
    render(<App />);
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('renders UpdateSplashScreen if OTA update is in progress', () => {
    mockUseOTAUpdates.mockReturnValue({ updateStatus: 'downloading' });
    render(<App />);
    expect(screen.getByTestId('update-splash-screen')).toBeTruthy();
  });

  it('renders loading indicator while app is not ready', () => {
    mockUseAppInitialization.mockReturnValue({
      ...mockUseAppInitialization(),
      isReady: false,
    });
    render(<App />);
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('renders IntroScreen if showIntro is true', () => {
    mockUseAppInitialization.mockReturnValue({
      ...mockUseAppInitialization(),
      isReady: true,
      showIntro: true,
    });
    render(<App />);
    expect(screen.getByTestId('intro-screen')).toBeTruthy();
  });

  it('renders AppNavigator when ready and intro is complete', () => {
    render(<App />);
    expect(screen.getByTestId('app-navigator')).toBeTruthy();
  });
});
