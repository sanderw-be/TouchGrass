import React from 'react';
import { render } from '@testing-library/react-native';

// Mock i18n
jest.mock('../i18n', () => ({
  __esModule: true,
  t: (key: string) => key,
  default: { locale: 'en' },
}));

// Mock App Store
jest.mock('../store/useAppStore', () => ({
  useAppStore: jest.fn((selector) =>
    selector({
      colors: {
        mist: '#f5f5f5',
        card: '#ffffff',
        textPrimary: '#000000',
        textSecondary: '#555555',
        textMuted: '#888888',
        fog: '#e0e0e0',
        grass: '#4CAF50',
        grassDark: '#2D5240',
        textInverse: '#ffffff',
      },
      shadows: {
        soft: {
          shadowColor: '#2D5240',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
      },
    })
  ),
}));

import AboutAppScreen from '../screens/AboutAppScreen';

describe('AboutAppScreen', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<AboutAppScreen />);
    expect(getByText('about_intro_title')).toBeTruthy();
  });

  it('renders all documentation sections', () => {
    const { getByText } = render(<AboutAppScreen />);
    expect(getByText('about_intro_title')).toBeTruthy();
    expect(getByText('about_intro_body')).toBeTruthy();
    expect(getByText('about_detection_title')).toBeTruthy();
    expect(getByText('about_detection_body')).toBeTruthy();
    expect(getByText('about_goals_title')).toBeTruthy();
    expect(getByText('about_goals_body')).toBeTruthy();
    expect(getByText('about_reminders_title')).toBeTruthy();
    expect(getByText('about_reminders_body')).toBeTruthy();
    expect(getByText('about_manual_title')).toBeTruthy();
    expect(getByText('about_manual_body')).toBeTruthy();
    expect(getByText('about_widget_title')).toBeTruthy();
    expect(getByText('about_widget_body')).toBeTruthy();
    expect(getByText('about_privacy_title')).toBeTruthy();
    expect(getByText('about_privacy_body')).toBeTruthy();
  });
});
