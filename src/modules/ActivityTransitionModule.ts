import { NativeModules } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BackgroundFeaturesNative } = NativeModules as any;

export const ActivityTransitionModule = {
  startTracking: async (): Promise<void> => {
    if (BackgroundFeaturesNative && BackgroundFeaturesNative.startActivityTransitionTracking) {
      await BackgroundFeaturesNative.startActivityTransitionTracking();
    }
  },
  stopTracking: async (): Promise<void> => {
    if (BackgroundFeaturesNative && BackgroundFeaturesNative.stopActivityTransitionTracking) {
      await BackgroundFeaturesNative.stopActivityTransitionTracking();
    }
  },
};
