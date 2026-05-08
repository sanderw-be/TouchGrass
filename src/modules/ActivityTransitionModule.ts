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
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('startTracking timeout')), 5000);
        });
        await Promise.race([
          BackgroundFeaturesNative.startActivityTransitionTracking(),
          timeoutPromise,
        ]);
      }
    } catch (e) {
      console.warn('ActivityTransitionModule: Failed to start tracking:', e);
      // We don't rethrow here to prevent crashing the app during init/sync.
      // The calling code should rely on permission checks for UI state.
    }
  },
  stopTracking: async (): Promise<void> => {
    try {
      if (BackgroundFeaturesNative && BackgroundFeaturesNative.stopActivityTransitionTracking) {
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('stopTracking timeout')), 5000);
        });
        await Promise.race([
          BackgroundFeaturesNative.stopActivityTransitionTracking(),
          timeoutPromise,
        ]);
      }
    } catch (e) {
      console.warn('ActivityTransitionModule: Failed to stop tracking:', e);
    }
  },
};
