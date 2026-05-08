import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import { NativeModules } from 'react-native';

jest.unmock('../modules/ActivityTransitionModule');

jest.mock('react-native', () => ({
  NativeModules: {
    BackgroundFeaturesNative: {
      startActivityTransitionTracking: jest.fn(() => Promise.resolve()),
      stopActivityTransitionTracking: jest.fn(() => Promise.resolve()),
    },
  },
}));

describe('ActivityTransitionModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts tracking successfully', async () => {
    await ActivityTransitionModule.startTracking();
    expect(
      NativeModules.BackgroundFeaturesNative.startActivityTransitionTracking
    ).toHaveBeenCalled();
  });

  it('stops tracking successfully', async () => {
    await ActivityTransitionModule.stopTracking();
    expect(
      NativeModules.BackgroundFeaturesNative.stopActivityTransitionTracking
    ).toHaveBeenCalled();
  });

  it('handles start tracking timeout gracefully', async () => {
    jest.useFakeTimers();
    (
      NativeModules.BackgroundFeaturesNative.startActivityTransitionTracking as jest.Mock
    ).mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 10000));
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const promise = ActivityTransitionModule.startTracking();
    jest.advanceTimersByTime(5000); // Trigger the timeout

    await promise;

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'ActivityTransitionModule: Failed to start tracking:',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('handles stop tracking timeout gracefully', async () => {
    jest.useFakeTimers();
    (
      NativeModules.BackgroundFeaturesNative.stopActivityTransitionTracking as jest.Mock
    ).mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 10000));
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const promise = ActivityTransitionModule.stopTracking();
    jest.advanceTimersByTime(5000); // Trigger the timeout

    await promise;

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'ActivityTransitionModule: Failed to stop tracking:',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
    jest.useRealTimers();
  });
});
