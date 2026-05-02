import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  GEOFENCE_TASK,
  DWELL_NOTIFICATION_ID,
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
import { colors } from '../utils/theme';
import { t } from '../i18n';

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
      return;
    }

    const { eventType, region } = data;
    const regionName = region.identifier || t('location_unknown');

    await initDatabaseAsync();

    if (eventType === Location.GeofencingEventType.Exit) {
      await insertBackgroundLogAsync(
        'gps',
        `Geofence EXIT: ${regionName}. Starting session and AR.`
      );
      console.log(`[GEOFENCE_TASK] Exited ${regionName}.`);

      // 1. Mark session start
      const now = Date.now();
      await setSettingAsync('gps_session_start', String(now));
      await setSettingAsync('gps_last_outside', '1');
      await setSettingAsync('gps_session_start_label', regionName);

      // 2. Start monitoring activity transitions
      await ActivityTransitionModule.startTracking();
    } else if (eventType === Location.GeofencingEventType.Enter) {
      await insertBackgroundLogAsync(
        'gps',
        `Geofence ENTER: ${regionName}. Stopping AR and recording session.`
      );
      console.log(`[GEOFENCE_TASK] Entered ${regionName}.`);

      // 1. Stop monitoring activity
      await ActivityTransitionModule.stopTracking();
      await Notifications.cancelScheduledNotificationAsync(DWELL_NOTIFICATION_ID);

      // 2. Finalize session
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

        await submitSession(
          buildSession(
            startTime,
            now,
            'gps',
            CONFIDENCE_GPS_ONLY, // Geofence confidence
            notes
          )
        );
        emitSessionsChanged();
        await insertBackgroundLogAsync(
          'gps',
          `Recorded ${Math.round(duration / 60000)} min session.`
        );
      }

      await setSettingAsync('gps_session_start', '0');
      await setSettingAsync('gps_last_outside', '0');
    }
  }
);
