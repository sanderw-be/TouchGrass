import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import {
  GEOFENCE_TASK,
  MIN_OUTSIDE_DURATION_MS,
  CONFIDENCE_GPS_ONLY,
} from '../detection/constants';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import {
  initDatabaseAsync,
  insertBackgroundLogAsync,
  setSettingAsync,
  getSettingAsync,
} from '../storage';
import { submitSession, buildSession } from '../detection/sessionMerger';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { t } from '../i18n';
import { getDwellService } from '../notifications/notificationManager';

/**
 * Task handler for Geofence events.
 *
 * Flow:
 * 1. User EXITS a known indoor geofence -> Start Activity Recognition monitoring.
 * 2. User ENTERS a known indoor geofence -> Stop Activity Recognition and cancel any pending dwell-time prompt.
 */
TaskManager.defineTask(
  GEOFENCE_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>) => {
    if (error) {
      console.error(`[GEOFENCE_TASK] Error: ${error.message}`);
    }

    if (!data || !data.region.identifier) {
      return;
    }

    const { eventType, region } = data;
    const regionId = region.identifier!; // Guarded above
    const regionName = regionId || t('location_unknown');

    await initDatabaseAsync();

    // Track active geofences to handle overlapping regions correctly
    const activeRaw = await getSettingAsync('active_geofences', '[]');
    let activeRegions: string[] = [];
    try {
      activeRegions = JSON.parse(activeRaw);
      if (!Array.isArray(activeRegions)) {
        activeRegions = [];
      }
    } catch {
      activeRegions = [];
    }

    const lastOutside = await getSettingAsync('gps_last_outside', '0');

    if (eventType === Location.GeofencingEventType.Exit) {
      // 1. Update active regions set
      activeRegions = activeRegions.filter((id) => id !== regionId);
      await setSettingAsync('active_geofences', JSON.stringify(activeRegions));

      // 2. Only mark as outside if NO regions remain active
      if (activeRegions.length === 0) {
        if (lastOutside === '1') {
          console.log(`[GEOFENCE_TASK] Already outside all regions. Skipping log/AR start.`);
        } else {
          await insertBackgroundLogAsync(
            'gps',
            `Geofence EXIT: ${regionName}. No active regions remain — starting session and AR.`
          );
          console.log(`[GEOFENCE_TASK] Exited ${regionName}. No active regions remain.`);

          const now = Date.now();
          await setSettingAsync('gps_session_start', String(now));
          await setSettingAsync('gps_last_outside', '1');
          await setSettingAsync('gps_session_start_label', regionName);

          // Start monitoring activity transitions
          await ActivityTransitionModule.startTracking();
        }
      } else {
        await insertBackgroundLogAsync(
          'gps',
          `Geofence EXIT: ${regionName}. Still inside ${activeRegions.length} other region(s).`
        );
        console.log(
          `[GEOFENCE_TASK] Exited ${regionName}, but still inside ${activeRegions.join(', ')}.`
        );
      }

      // 3. ALWAYS cancel any pending dwell prompt on EXIT (because we are moving)
      try {
        await getDwellService().cancelDwellPrompt();
      } catch (e) {
        console.warn('[GEOFENCE_TASK] Failed to cancel dwell prompt on EXIT:', e);
      }
    } else if (eventType === Location.GeofencingEventType.Enter) {
      // 1. Update active regions set
      if (!activeRegions.includes(regionId)) {
        activeRegions.push(regionId);
        await setSettingAsync('active_geofences', JSON.stringify(activeRegions));
      }

      // 2. Mark as inside
      if (lastOutside === '0') {
        console.log(`[GEOFENCE_TASK] Already inside (at least one region). Skipping log/AR stop.`);
      } else {
        await insertBackgroundLogAsync(
          'gps',
          `Geofence ENTER: ${regionName}. Stopping AR and recording session.`
        );
        console.log(`[GEOFENCE_TASK] Entered ${regionName}.`);

        // Stop monitoring activity
        await ActivityTransitionModule.stopTracking();
        await setSettingAsync('gps_last_outside', '0');
      }

      // 3. ALWAYS cancel any pending dwell prompt on ENTER (we are now in a known location)
      try {
        await getDwellService().cancelDwellPrompt();
      } catch (e) {
        console.warn('[GEOFENCE_TASK] Failed to cancel dwell prompt on ENTER:', e);
      }

      // 4. Finalize session (only if it was the FIRST enter after being outside)
      // Note: we only finalize if we were outside. If we move from A to B, we stay "inside".
      const startRaw = await getSettingAsync('gps_session_start', '0');
      const startTime = parseInt(startRaw, 10);
      const now = Date.now();
      const duration = now - startTime;

      if (startTime > 0 && duration >= MIN_OUTSIDE_DURATION_MS) {
        // 5 min minimum
        const startLabel = await getSettingAsync('gps_session_start_label', '');

        const notes = t('gps_session_notes_template', {
          startLabel: startLabel || t('location_somewhere'),
          regionName,
        });

        await submitSession(buildSession(startTime, now, 'gps', CONFIDENCE_GPS_ONLY, notes));
        emitSessionsChanged();
        await insertBackgroundLogAsync(
          'gps',
          `Recorded ${Math.round(duration / 60000)} min session.`
        );
      }

      await setSettingAsync('gps_session_start', '0');
    }
  }
);
