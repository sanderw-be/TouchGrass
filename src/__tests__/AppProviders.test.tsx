import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { AppProviders } from '../components/AppProviders';

// Mock components that might have side effects or complex logic
jest.mock('../components/ReminderFeedbackModal', () => {
  const { Text } = require('react-native');
  return () => <Text testID="reminder-feedback-modal">ReminderFeedbackModal</Text>;
});

describe('AppProviders', () => {
  it('renders children and ReminderFeedbackModal', async () => {
    render(
      <AppProviders>
        <View>
          <Text testID="child-text">Child Content</Text>
        </View>
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('child-text')).toBeTruthy();
    });
    expect(screen.getByText('Child Content')).toBeTruthy();
    expect(screen.getByTestId('reminder-feedback-modal')).toBeTruthy();
  });
});
