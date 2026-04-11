import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('../storage/database', () => ({
  updateSessionNotesAsync: jest.fn().mockResolvedValue(undefined),
}));

import SessionNotesSheet from '../components/SessionNotesSheet';
import { OutsideSession, updateSessionNotesAsync } from '../storage/database';

const mockSession: OutsideSession = {
  id: 42,
  startTime: new Date('2024-01-01T09:00:00.000Z').getTime(),
  endTime: new Date('2024-01-01T09:30:00.000Z').getTime(),
  durationMinutes: 30,
  source: 'gps',
  confidence: 0.8,
  userConfirmed: 1,
  discarded: 0,
  notes: 'Existing note',
};

const defaultProps = {
  visible: true,
  session: mockSession,
  onClose: jest.fn(),
  onNoteSaved: jest.fn(),
};

describe('SessionNotesSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    const { getByText } = render(<SessionNotesSheet {...defaultProps} />);
    expect(getByText('session_notes_title')).toBeTruthy();
  });

  it('shows existing notes in the text input', () => {
    const { getByTestId } = render(<SessionNotesSheet {...defaultProps} />);
    const input = getByTestId('notes-text-input');
    expect(input.props.value).toBe('Existing note');
  });

  it('shows the save button', () => {
    const { getByText } = render(<SessionNotesSheet {...defaultProps} />);
    expect(getByText('session_notes_save')).toBeTruthy();
  });

  it('calls updateSessionNotesAsync and onNoteSaved when save is pressed', async () => {
    const onNoteSaved = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SessionNotesSheet {...defaultProps} onNoteSaved={onNoteSaved} onClose={onClose} />
    );
    await act(async () => {
      fireEvent.press(getByTestId('notes-save-btn'));
    });
    expect(updateSessionNotesAsync).toHaveBeenCalledWith(42, 'Existing note');
    expect(onNoteSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('allows editing the notes text', () => {
    const { getByTestId } = render(<SessionNotesSheet {...defaultProps} />);
    const input = getByTestId('notes-text-input');
    fireEvent.changeText(input, 'Updated note');
    expect(input.props.value).toBe('Updated note');
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<SessionNotesSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByTestId('notes-sheet-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when session is null', () => {
    const { queryByText } = render(<SessionNotesSheet {...defaultProps} session={null} />);
    expect(queryByText('session_notes_title')).toBeNull();
  });

  it('initialises with empty string when session has no notes', () => {
    const sessionNoNotes: OutsideSession = { ...mockSession, notes: undefined };
    const { getByTestId } = render(
      <SessionNotesSheet {...defaultProps} session={sessionNoNotes} />
    );
    const input = getByTestId('notes-text-input');
    expect(input.props.value).toBe('');
  });
});
