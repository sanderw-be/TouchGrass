import { useState, useEffect } from 'react';
import * as Updates from 'expo-updates';

export type UpdateSplashStatus = 'checking' | 'downloading' | 'ready';

export function useOTAUpdates() {
  // Initialize state based on environment. If in dev, we are instantly 'ready'.
  const [updateStatus, setUpdateStatus] = useState<UpdateSplashStatus>(() =>
    !__DEV__ && Updates.isEnabled ? 'checking' : 'ready'
  );

  useEffect(() => {
    // 1. Immediately abort if we are in local development
    if (__DEV__) {
      console.log('Running in dev client — skipping EAS updates.');
      return; // updateStatus is already 'ready' from initial state
    }

    // 2. Abort if the updates library is completely disabled
    if (!Updates.isEnabled) {
      setUpdateStatus('ready');
      return;
    }

    let cancelled = false;

    // 3. Set a 3-second fallback timeout so the app is never indefinitely blocked
    const timeout = setTimeout(() => {
      if (!cancelled) setUpdateStatus('ready');
    }, 3000);

    // 4. Check for and apply updates
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();

        if (cancelled) return;
        clearTimeout(timeout);

        if (result.isAvailable) {
          setUpdateStatus('downloading');
          await Updates.fetchUpdateAsync();
          if (!cancelled) {
            await Updates.reloadAsync();
          }
        } else {
          setUpdateStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          clearTimeout(timeout);
          console.warn('Failed to apply OTA update:', error);
          setUpdateStatus('ready');
        }
      }
    })();

    // Cleanup function to prevent state updates if unmounted
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return { updateStatus };
}
