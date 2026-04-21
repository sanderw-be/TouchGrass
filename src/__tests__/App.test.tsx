import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { useAppStore } from '../store/useAppStore';
import { useOTAUpdates } from '../hooks/useOTAUpdates';

// Mock hooks
jest.mock('../store/useAppStore');
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

const mockUseAppStore = useAppStore as unknown as jest.Mock;
const mockUseOTAUpdates = useOTAUpdates as jest.Mock;
const mockUseFonts = require('expo-font').useFonts as jest.Mock;

describe('<App />', () => {
  const defaultStoreState = {
    isReady: true,
    showIntro: false,
    locale: 'en',
    colors: { mist: '#f5f5f5', grass: '#4A7C59', card: '#ffffff' },
    shadows: { soft: {}, medium: {} },
    handleIntroComplete: jest.fn(),
    initialize: jest.fn(),
    setSystemColorScheme: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFonts.mockReturnValue([true]);
    mockUseOTAUpdates.mockReturnValue({ updateStatus: 'ready' });
    mockUseAppStore.mockImplementation((selector) => selector(defaultStoreState));
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
    mockUseAppStore.mockImplementation((selector) =>
      selector({
        ...defaultStoreState,
        isReady: false,
      })
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('activity-indicator')).toBeTruthy();
    });
  });

  it('renders IntroScreen if showIntro is true', async () => {
    mockUseAppStore.mockImplementation((selector) =>
      selector({
        ...defaultStoreState,
        isReady: true,
        showIntro: true,
      })
    );
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
