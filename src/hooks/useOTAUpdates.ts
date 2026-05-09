import { useState, useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { getSettingAsync, setSettingAsync } from '../storage';
import { stopGeofenceTracking, stopLocationTracking } from '../detection/gpsDetection';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';

export type OTAUpdateStatus = 'checking' | 'downloading' | 'ready';

const LAST_FAILED_UPDATE_KEY = 'OTA_LAST_FAILED_UPDATE_ID';

export function useOTAUpdates() {
  // Initialize state based on environment. If in dev, we are instantly 'ready'.
  const [updateStatus, setUpdateStatus] = useState<OTAUpdateStatus>(() =>
    !__DEV__ && Updates.isEnabled ? 'checking' : 'ready'
  );

  const handleReload = useCallback(async (updateId: string) => {
    // Record that we are attempting to load this update
    await setSettingAsync(LAST_FAILED_UPDATE_KEY, updateId);

    // Safeguard: Stop background tasks before reload to prevent crashes
    // during React instance destruction (especially in Bridgeless mode).
    try {
      await Promise.all([
        stopGeofenceTracking(),
        stopLocationTracking(),
        ActivityTransitionModule.stopTracking(),
      ]);
    } catch (e) {
      console.warn('[OTA] Failed to stop background tasks before reload:', e);
    }

    await Updates.reloadAsync();
  }, []);

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

    // 3. Set a 10-second fallback timeout so the app is never indefinitely blocked
    // (Increased from 3s to allow for setting reads/writes)
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('OTA update check timed out.');
        setUpdateStatus('ready');
      }
    }, 10000);

    // 4. Check for and apply updates
    (async () => {
      try {
        const currentUpdateId = Updates.updateId;
        const lastFailedId = await getSettingAsync(LAST_FAILED_UPDATE_KEY, '');

        const result = await Updates.checkForUpdateAsync();

        if (cancelled) return;

        if (result.isAvailable) {
          // B. Retry Guard: If the available update matches the last failed ID, skip it.
          const availableUpdateId = result.manifest?.id || 'unknown';
          if (availableUpdateId === lastFailedId) {
            console.warn(
              `[useOTAUpdates] Available update (${availableUpdateId}) was previously marked as failed. Skipping to prevent bootloop.`
            );
            clearTimeout(timeout);
            setUpdateStatus('ready');
            return;
          }

          setUpdateStatus('downloading');
          await Updates.fetchUpdateAsync();

          if (!cancelled) {
            clearTimeout(timeout);
            await handleReload(availableUpdateId || 'unknown');
          }
        } else {
          clearTimeout(timeout);
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

    // 5. Failure Guard Cleanup: If the app survives for 30s, clear the failure record
    const stabilityTimer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const currentUpdateId = Updates.updateId;
        const lastFailedId = await getSettingAsync(LAST_FAILED_UPDATE_KEY, '');

        if (currentUpdateId && currentUpdateId === lastFailedId) {
          console.log('[useOTAUpdates] App stable for 30s. Clearing failure guard.');
          await setSettingAsync(LAST_FAILED_UPDATE_KEY, '');
        }
      } catch (e) {
        console.error('[useOTAUpdates] Failed to clear failure guard:', e);
      }
    }, 30000);

    // Cleanup function to prevent state updates if unmounted
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(stabilityTimer);
    };
  }, [handleReload]);

  return { updateStatus };
}
