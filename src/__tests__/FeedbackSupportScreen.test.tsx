import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking, Alert } from 'react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  __esModule: true,
  t: (key: string) => key,
  default: { locale: 'en' },
}));

// Mock ThemeContext
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      mist: '#f5f5f5',
      card: '#ffffff',
      textPrimary: '#000000',
      textMuted: '#888888',
      fog: '#e0e0e0',
      grass: '#4CAF50',
    },
  }),
}));

import FeedbackSupportScreen from '../screens/FeedbackSupportScreen';

describe('FeedbackSupportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders feedback and kofi rows', () => {
    const { getByText } = render(<FeedbackSupportScreen />);
    expect(getByText('feedback_send_feedback')).toBeTruthy();
    expect(getByText('feedback_support_kofi')).toBeTruthy();
  });

  it('opens the English feedback form when locale is en', async () => {
    const { getByText } = render(<FeedbackSupportScreen />);
    fireEvent.press(getByText('feedback_send_feedback'));
    await Promise.resolve(); // flush async
    expect(Linking.openURL).toHaveBeenCalledWith('https://forms.gle/P6Www1U1yiurgk2D6');
  });

  it('opens Ko-fi when support row is pressed', async () => {
    const { getByText } = render(<FeedbackSupportScreen />);
    fireEvent.press(getByText('feedback_support_kofi'));
    await Promise.resolve();
    expect(Linking.openURL).toHaveBeenCalledWith('https://ko-fi.com/jollyheron');
  });

  it('opens the Dutch feedback form when locale is nl', async () => {
    const i18n = require('../i18n');
    i18n.default.locale = 'nl';
    const { getByText } = render(<FeedbackSupportScreen />);
    fireEvent.press(getByText('feedback_send_feedback'));
    await Promise.resolve();
    expect(Linking.openURL).toHaveBeenCalledWith('https://forms.gle/SSavqQgWFqYmiJaZA');
    i18n.default.locale = 'en';
  });

  it('shows alert when URL cannot be opened', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const { getByText } = render(<FeedbackSupportScreen />);
    fireEvent.press(getByText('feedback_support_kofi'));
    await Promise.resolve();
    expect(Alert.alert).toHaveBeenCalledWith('https://ko-fi.com/jollyheron');
  });
});
