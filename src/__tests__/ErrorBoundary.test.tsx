import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  __esModule: true,
  default: { locale: 'en', t: (key: string) => key },
  t: (key: string) => key,
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
    deviceName: 'Test Device',
  },
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  __esModule: true,
  nativeApplicationVersion: '1.0.0',
}));

import ErrorBoundary from '../components/ErrorBoundary';

// A component that unconditionally throws to trigger the error boundary
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return null;
}

describe('ErrorBoundary', () => {
  // Suppress console.error output for expected errors during tests
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    // No fallback UI should be shown
    expect(() => getByText('error_boundary_title')).toThrow();
  });

  it('shows fallback UI when a child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(getByText('error_boundary_title')).toBeTruthy();
    expect(getByText('error_boundary_subtitle')).toBeTruthy();
    expect(getByText('error_boundary_restart')).toBeTruthy();
    expect(getByText('error_boundary_report')).toBeTruthy();
  });

  it('resets error state when Restart button is pressed', () => {
    // Use a ref-controlled component so we can stop it throwing after reset
    let shouldThrow = true;

    function TogglableThrow() {
      if (shouldThrow) throw new Error('Test render error');
      return null;
    }

    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <TogglableThrow />
      </ErrorBoundary>
    );

    expect(getByText('error_boundary_title')).toBeTruthy();

    // Stop throwing before pressing Restart so the re-render succeeds
    shouldThrow = false;
    fireEvent.press(getByText('error_boundary_restart'));

    // After reset, the fallback should no longer be visible
    expect(queryByText('error_boundary_title')).toBeNull();
  });

  it('opens the crash report feedback form URL when Report button is pressed (locale en)', async () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    fireEvent.press(getByText('error_boundary_report'));

    await Promise.resolve();

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('1FAIpQLSffz8JgoPPf2KxIpn86iYQxkNY33-k3wO3MOLDO7CQvbFNitg')
    );
  });

  it('opens the crash report feedback form URL when Report button is pressed (locale nl)', async () => {
    const i18n = require('../i18n');
    i18n.default.locale = 'nl';

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    fireEvent.press(getByText('error_boundary_report'));

    await Promise.resolve();

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('1FAIpQLSffz8JgoPPf2KxIpn86iYQxkNY33-k3wO3MOLDO7CQvbFNitg')
    );

    i18n.default.locale = 'en';
  });

  it('prefills device info in the feedback URL', async () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    fireEvent.press(getByText('error_boundary_report'));

    await Promise.resolve();

    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('usp=pp_url');
    expect(calledUrl).toContain('entry.1795846861');
    expect(calledUrl).toContain('entry.411078901');
    expect(calledUrl).toContain(encodeURIComponent('App: 1.0.0'));
    expect(calledUrl).toContain(encodeURIComponent('Device: Test Device'));
  });

  it('prefills the error message in the feedback URL', async () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    fireEvent.press(getByText('error_boundary_report'));

    await Promise.resolve();

    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('Test render error'));
  });

  it('logs the error via console.error on componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('TouchGrass: Unhandled render error:'),
      expect.any(Error),
      expect.anything()
    );
  });
});
