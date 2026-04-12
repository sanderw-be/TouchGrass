import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Share } from 'react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
  default: { locale: 'en' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// expo-updates and expo-application are mocked globally in jest.setup.js

import DiagnosticSheet from '../components/DiagnosticSheet';

describe('DiagnosticSheet', () => {
  it('renders when visible is true', () => {
    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);
    expect(getByTestId('diagnostic-sheet')).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    const { queryByTestId } = render(<DiagnosticSheet visible={false} onClose={jest.fn()} />);
    // Modal with visible=false hides its content
    expect(queryByTestId('diagnostic-sheet')).toBeNull();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DiagnosticSheet visible onClose={onClose} />);

    fireEvent.press(getByTestId('diagnostic-close-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the sheet is dismissed via close button', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<DiagnosticSheet visible onClose={onClose} />);

    // Press the close button, which calls dismiss() on the BottomSheetModal
    // In the real app, dismiss also occurs when tapping the backdrop
    fireEvent.press(getByTestId('diagnostic-close-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the mocked diagnostic values', () => {
    const { getByText } = render(<DiagnosticSheet visible onClose={jest.fn()} />);

    // i18n is mocked to return keys, so we look for the mocked data values
    expect(getByText('preview')).toBeTruthy(); // channel from jest.setup mock
    expect(getByText('1.2.0 (45)')).toBeTruthy(); // version from jest.setup mock
  });

  it('invokes Share when share button is pressed', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });

    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);

    fireEvent.press(getByTestId('diagnostic-share-btn'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    expect(shareSpy.mock.calls[0][0]).toHaveProperty('message');
  });

  it('shows the check-for-update button when Updates.isEnabled is true', () => {
    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);
    expect(getByTestId('diagnostic-check-update-btn')).toBeTruthy();
  });

  it('calls checkForUpdateAsync when the check-for-update button is pressed', async () => {
    const Updates = require('expo-updates');
    Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false });

    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);

    await act(async () => {
      fireEvent.press(getByTestId('diagnostic-check-update-btn'));
    });

    expect(Updates.checkForUpdateAsync).toHaveBeenCalled();
  });

  it('fetches and reloads when an update is available', async () => {
    const Updates = require('expo-updates');
    Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: true });
    Updates.fetchUpdateAsync.mockResolvedValueOnce({ isNew: true });
    Updates.reloadAsync.mockResolvedValueOnce(undefined);

    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);

    await act(async () => {
      fireEvent.press(getByTestId('diagnostic-check-update-btn'));
    });

    expect(Updates.fetchUpdateAsync).toHaveBeenCalled();
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });

  it('sets checkState to done when no update is available', async () => {
    const Updates = require('expo-updates');
    Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false });

    const { getByTestId } = render(<DiagnosticSheet visible onClose={jest.fn()} />);
    const btn = getByTestId('diagnostic-check-update-btn');

    await act(async () => {
      fireEvent.press(btn);
    });

    // After the check, the button should be disabled (checkState !== 'idle')
    expect(btn.props.accessibilityState?.disabled || btn.props.disabled).toBeTruthy();
  });
});
