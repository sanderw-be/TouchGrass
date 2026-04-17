import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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

  it('renders font loading indicator if fonts are not loaded', async () => {
    mockUseFonts.mockReturnValue([false]);
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('activity-indicator')).toBeTruthy();
    });
  });

  it('renders UpdateSplashScreen if OTA update is in progress', async () => {
    mockUseOTAUpdates.mockReturnValue({ updateStatus: 'downloading' });
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('update-splash-screen')).toBeTruthy();
    });
  });

  it('renders loading indicator while app is not ready', async () => {
    mockUseAppInitialization.mockReturnValue({
      ...mockUseAppInitialization(),
      isReady: false,
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('activity-indicator')).toBeTruthy();
    });
  });

  it('renders IntroScreen if showIntro is true', async () => {
    mockUseAppInitialization.mockReturnValue({
      ...mockUseAppInitialization(),
      isReady: true,
      showIntro: true,
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('intro-screen')).toBeTruthy();
    });
  });

  it('renders AppNavigator when ready and intro is complete', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('app-navigator')).toBeTruthy();
    });
  });
});
