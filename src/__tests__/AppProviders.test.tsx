import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { AppProviders } from '../components/AppProviders';

// Mock components that might have side effects or complex logic
jest.mock('../components/ReminderFeedbackModal', () => {
  const { Text } = require('react-native');
  return () => <Text testID="reminder-feedback-modal">ReminderFeedbackModal</Text>;
});

describe('AppProviders', () => {
  it('renders children and ReminderFeedbackModal', () => {
    render(
      <AppProviders>
        <View>
          <Text testID="child-text">Child Content</Text>
        </View>
      </AppProviders>
    );

    expect(screen.getByTestId('child-text')).toBeTruthy();
    expect(screen.getByText('Child Content')).toBeTruthy();
    expect(screen.getByTestId('reminder-feedback-modal')).toBeTruthy();
  });
});
