import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      colors: {
        mist: '#F8F9F7',
        textPrimary: '#1A1A1A',
        textMuted: '#888888',
        grass: '#4A7C59',
      },
      shadows: {},
    })
  ),
}));

import UpdateSplashScreen from '../components/UpdateSplashScreen';

describe('UpdateSplashScreen', () => {
  it('renders the screen container', () => {
    const { getByTestId } = render(<UpdateSplashScreen status="checking" />);
    expect(getByTestId('update-splash-screen')).toBeTruthy();
  });

  it('shows the logo', () => {
    const { getByTestId } = render(<UpdateSplashScreen status="checking" />);
    expect(getByTestId('update-splash-logo')).toBeTruthy();
  });

  it('shows the spinner', () => {
    const { getByTestId } = render(<UpdateSplashScreen status="checking" />);
    expect(getByTestId('update-splash-spinner')).toBeTruthy();
  });

  it('shows "checking" status text when status is checking', () => {
    const { getByTestId } = render(<UpdateSplashScreen status="checking" />);
    expect(getByTestId('update-splash-status').props.children).toBe('update_splash_checking');
  });

  it('shows "downloading" status text when status is downloading', () => {
    const { getByTestId } = render(<UpdateSplashScreen status="downloading" />);
    expect(getByTestId('update-splash-status').props.children).toBe('update_splash_downloading');
  });
});
