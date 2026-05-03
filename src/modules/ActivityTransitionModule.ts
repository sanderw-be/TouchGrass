import { NativeModules } from 'react-native';

interface ActivityTransitionNativeInterface {
  startActivityTransitionTracking(): Promise<void>;
  stopActivityTransitionTracking(): Promise<void>;
}

const BackgroundFeaturesNative = NativeModules.BackgroundFeaturesNative as
  | ActivityTransitionNativeInterface
  | undefined;

export const ActivityTransitionModule = {
  startTracking: async (): Promise<void> => {
    try {
      if (BackgroundFeaturesNative && BackgroundFeaturesNative.startActivityTransitionTracking) {
        await BackgroundFeaturesNative.startActivityTransitionTracking();
      }
    } catch (e) {
      console.error('ActivityTransitionModule: Failed to start tracking:', e);
      // We don't rethrow here to prevent crashing the app during init/sync.
      // The calling code should rely on permission checks for UI state.
    }
  },
  stopTracking: async (): Promise<void> => {
    try {
      if (BackgroundFeaturesNative && BackgroundFeaturesNative.stopActivityTransitionTracking) {
        await BackgroundFeaturesNative.stopActivityTransitionTracking();
      }
    } catch (e) {
      console.error('ActivityTransitionModule: Failed to stop tracking:', e);
    }
  },
};
