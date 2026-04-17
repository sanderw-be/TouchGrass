import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { useOTAUpdates } from '../hooks/useOTAUpdates';

// Mock the entire expo-updates module
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

// Mock console to prevent polluting test output
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('useOTAUpdates', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset __DEV__ and isEnabled to default "production" state for tests
    Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
    (Updates.isEnabled as boolean) = true;
  });

  it('should immediately be "ready" and skip checks if in dev mode (__DEV__ is true)', () => {
    Object.defineProperty(global, '__DEV__', { value: true, configurable: true });

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('ready');
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('should immediately become "ready" and skip checks if Updates.isEnabled is false', () => {
    (Updates.isEnabled as boolean) = false;

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('ready');
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('should transition from "checking" to "ready" if no update is available', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: false });

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('checking');

    await waitFor(() => {
      expect(result.current.updateStatus).toBe('ready');
    });

    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('should transition to "downloading", fetch, and reload if an update is available', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: true });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue(undefined);
    (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('checking');

    await waitFor(() => expect(result.current.updateStatus).toBe('downloading'));
    await waitFor(() => expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(Updates.reloadAsync).toHaveBeenCalledTimes(1));
  });

  it('should transition to "ready" if checking for an update fails', async () => {
    const error = new Error('Network error');
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('checking');

    await waitFor(() => expect(result.current.updateStatus).toBe('ready'));
    expect(console.warn).toHaveBeenCalledWith('Failed to apply OTA update:', error);
  });

  it('should fall back to "ready" after the 3-second timeout', async () => {
    jest.useFakeTimers();
    // Mock a check that never resolves
    (Updates.checkForUpdateAsync as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOTAUpdates());
    expect(result.current.updateStatus).toBe('checking');

    // Advance timers past the 3s timeout
    act(() => jest.advanceTimersByTime(3001));

    await waitFor(() => expect(result.current.updateStatus).toBe('ready'));
    jest.useRealTimers();
  });
});
