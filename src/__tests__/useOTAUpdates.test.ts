import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { useOTAUpdates } from '../hooks/useOTAUpdates';
import { getSettingAsync, setSettingAsync } from '../storage';
import { stopGeofenceTracking, stopLocationTracking } from '../detection/gpsDetection';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';

// Mock the entire expo-updates module
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  updateId: 'current-stable-id',
}));

// Mock the storage module
jest.mock('../storage', () => ({
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
}));

// Mock detection tasks
jest.mock('../detection/gpsDetection', () => ({
  stopGeofenceTracking: jest.fn().mockResolvedValue(undefined),
  stopLocationTracking: jest.fn().mockResolvedValue(undefined),
}));

// Mock native modules
jest.mock('../modules/ActivityTransitionModule', () => ({
  ActivityTransitionModule: {
    stopTracking: jest.fn().mockResolvedValue(undefined),
  },
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
    (Updates as any).updateId = 'current-stable-id';

    // Default storage behavior
    (getSettingAsync as jest.Mock).mockResolvedValue('');
    (setSettingAsync as jest.Mock).mockResolvedValue(undefined);
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

  it('should transition to "downloading", fetch, stop tasks, and reload if an update is available', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: true,
      manifest: { id: 'new-update-id' },
    });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue(undefined);
    (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('checking');

    await waitFor(() => expect(result.current.updateStatus).toBe('downloading'));
    await waitFor(() => expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1));

    // Verify it records the ID before reloading
    await waitFor(() =>
      expect(setSettingAsync).toHaveBeenCalledWith('OTA_LAST_FAILED_UPDATE_ID', 'new-update-id')
    );

    // Verify it stops background tasks before reloading
    await waitFor(() => expect(stopGeofenceTracking).toHaveBeenCalled());
    await waitFor(() => expect(stopLocationTracking).toHaveBeenCalled());
    await waitFor(() => expect(ActivityTransitionModule.stopTracking).toHaveBeenCalled());

    await waitFor(() => expect(Updates.reloadAsync).toHaveBeenCalledTimes(1));
  });

  it('should clear the failure guard if the current update matches the last failed ID', async () => {
    (Updates as any).updateId = 'previously-failed-id';
    (getSettingAsync as jest.Mock).mockResolvedValue('previously-failed-id');
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: false });

    renderHook(() => useOTAUpdates());

    await waitFor(() =>
      expect(setSettingAsync).toHaveBeenCalledWith('OTA_LAST_FAILED_UPDATE_ID', '')
    );
  });

  it('should skip the update if the available update ID matches the last failed ID', async () => {
    (getSettingAsync as jest.Mock).mockResolvedValue('crashing-update-id');
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: true,
      manifest: { id: 'crashing-update-id' },
    });

    const { result } = renderHook(() => useOTAUpdates());

    await waitFor(() => expect(result.current.updateStatus).toBe('ready'));
    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('previously marked as failed. Skipping')
    );
  });

  it('should transition to "ready" if checking for an update fails', async () => {
    const error = new Error('Network error');
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useOTAUpdates());

    expect(result.current.updateStatus).toBe('checking');

    await waitFor(() => expect(result.current.updateStatus).toBe('ready'));
    expect(console.warn).toHaveBeenCalledWith('Failed to apply OTA update:', error);
  });

  it('should fall back to "ready" after the 10-second timeout', async () => {
    jest.useFakeTimers();
    // Mock a check that never resolves
    (Updates.checkForUpdateAsync as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOTAUpdates());
    expect(result.current.updateStatus).toBe('checking');

    // Advance timers past the 10s timeout
    act(() => jest.advanceTimersByTime(10001));

    await waitFor(() => expect(result.current.updateStatus).toBe('ready'));
    expect(console.warn).toHaveBeenCalledWith('OTA update check timed out.');
    jest.useRealTimers();
  });
});
