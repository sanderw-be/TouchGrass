import { initialize, readRecords } from 'react-native-health-connect';
import {
  getSettingAsync,
  setSettingAsync,
  getKnownLocationsAsync,
  insertBackgroundLogAsync,
  pruneShortDiscardedHealthConnectSessionsAsync,
} from '../storage';
import { submitSession, buildSession } from './sessionMerger';
import { emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { wasDefinitelyAtKnownIndoorLocationSync, LocationSample } from './GeofenceManager';
import { t } from '../i18n';
import {
  MIN_DURATION_MS,
  STEPS_PER_MINUTE_AT_5KMH,
  CONFIDENCE_ACTIVITY,
  HC_SYNC_COOLDOWN_MS,
  CONFIDENCE_SLOW_WALK,
  STEPS_PER_MIN_AT_4KMH,
  BASELINE_SPEED_KMH,
  STEPS_PER_MIN_AT_2_5KMH,
} from './constants';
import { isImperialUnits, kmhToMph } from '../utils/units';

export class HealthSessionBuilder {
  private static syncInProgress = false;

  public static async syncHealthConnect(): Promise<boolean> {
    if (this.syncInProgress) return false;

    if ((await getSettingAsync('healthconnect_enabled', '0')) !== '1') {
      return false;
    }

    const lastSync = parseInt(await getSettingAsync('healthconnect_last_sync', '0'), 10);
    const now = Date.now();
    if (lastSync > 0 && now - lastSync < HC_SYNC_COOLDOWN_MS) {
      return false;
    }

    this.syncInProgress = true;
    try {
      await initialize();
      const syncTime = Date.now();
      const startTime = lastSync > 0 ? lastSync : syncTime - 7 * 24 * 60 * 60 * 1000;
      const startTimeISO = new Date(startTime).toISOString();
      const endTimeISO = new Date(syncTime).toISOString();

      let locationSamples: LocationSample[] = [];
      try {
        const parsed = JSON.parse(await getSettingAsync('location_clusters', '[]'));
        locationSamples = Array.isArray(parsed) ? parsed : [];
      } catch {}
      const knownLocations = await getKnownLocationsAsync();

      // Exercise Sessions
      const initialExerciseResult = await readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: startTimeISO, endTime: endTimeISO },
      });
      const exerciseRecords = [...initialExerciseResult.records];
      let exercisePageToken = initialExerciseResult.pageToken;
      while (exercisePageToken) {
        const nextResult = await readRecords('ExerciseSession', {
          timeRangeFilter: { operator: 'between', startTime: startTimeISO, endTime: endTimeISO },
          pageToken: exercisePageToken,
        });
        exerciseRecords.push(...nextResult.records);
        exercisePageToken = nextResult.pageToken;
      }

      let exerciseCount = 0;
      for (const record of exerciseRecords) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        const duration = end - start;
        if (duration < MIN_DURATION_MS) continue;

        if (wasDefinitelyAtKnownIndoorLocationSync(start, end, locationSamples, knownLocations))
          continue;

        const isExplicitlyOutdoor = this.isOutdoorExerciseType(record.exerciseType);
        const confidence = isExplicitlyOutdoor ? 0.8 : CONFIDENCE_ACTIVITY;

        await submitSession(
          buildSession(
            start,
            end,
            'health_connect',
            confidence,
            this.buildHCExerciseNotes(this.exerciseTypeName(record.exerciseType), duration)
          )
        );
        exerciseCount++;
      }

      // Steps
      const initialStepsResult = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: startTimeISO, endTime: endTimeISO },
      });
      const stepsRecords = [...initialStepsResult.records];
      let stepsPageToken = initialStepsResult.pageToken;
      while (stepsPageToken) {
        const nextResult = await readRecords('Steps', {
          timeRangeFilter: { operator: 'between', startTime: startTimeISO, endTime: endTimeISO },
          pageToken: stepsPageToken,
        });
        stepsRecords.push(...nextResult.records);
        stepsPageToken = nextResult.pageToken;
      }

      let stepRecordCount = 0;
      for (const record of stepsRecords) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        const recordedDuration = end - start;
        const estimatedDurationMs = (record.count / STEPS_PER_MINUTE_AT_5KMH) * 60_000;
        const effectiveDurationMs = Math.max(recordedDuration, estimatedDurationMs);
        const sessionStart = end - effectiveDurationMs;

        if (
          wasDefinitelyAtKnownIndoorLocationSync(sessionStart, end, locationSamples, knownLocations)
        )
          continue;

        const stepsPerMinute = record.count / (effectiveDurationMs / 60_000);
        const isSlowWalking = stepsPerMinute < STEPS_PER_MIN_AT_4KMH;
        const stepConfidence = isSlowWalking ? CONFIDENCE_SLOW_WALK : CONFIDENCE_ACTIVITY;
        const stepSpeedKmh = (stepsPerMinute / STEPS_PER_MINUTE_AT_5KMH) * BASELINE_SPEED_KMH;

        await submitSession({
          ...buildSession(sessionStart, end, 'health_connect', stepConfidence),
          steps: record.count,
          notes: this.buildHCStepsNotes(record.count, stepSpeedKmh),
        });
        stepRecordCount++;
      }

      await insertBackgroundLogAsync(
        'health_connect',
        `Synced ${stepRecordCount} step records and ${exerciseCount} exercise records`
      );

      await pruneShortDiscardedHealthConnectSessionsAsync(
        syncTime - MIN_DURATION_MS,
        STEPS_PER_MIN_AT_2_5KMH
      );

      await setSettingAsync('healthconnect_last_sync', String(syncTime));
      emitSessionsChanged();
      return true;
    } catch (e: unknown) {
      console.warn('Health Connect sync error:', e);
      if (e instanceof Error && e.message.includes('SecurityException')) {
        await setSettingAsync('healthconnect_enabled', '0');
        await insertBackgroundLogAsync(
          'health_connect',
          'Permission error - Health Connect disabled'
        );
      }
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private static isOutdoorExerciseType(type: number): boolean {
    const outdoorTypes = [8, 37, 56, 58, 72, 79]; // Biking, Hiking, Running, Sailing, Surfing, Walking
    return outdoorTypes.includes(type);
  }

  private static exerciseTypeName(type: number): string {
    const keyMap: Record<number, string> = {
      2: 'exercise_badminton',
      4: 'exercise_baseball',
      5: 'exercise_basketball',
      8: 'exercise_biking',
      14: 'exercise_cricket',
      28: 'exercise_american_football',
      29: 'exercise_australian_football',
      31: 'exercise_frisbee',
      32: 'exercise_golf',
      35: 'exercise_handball',
      37: 'exercise_hiking',
      38: 'exercise_ice_hockey',
      39: 'exercise_ice_skating',
      46: 'exercise_paddling',
      47: 'exercise_paragliding',
      51: 'exercise_rock_climbing',
      52: 'exercise_roller_hockey',
      53: 'exercise_rowing',
      55: 'exercise_rugby',
      56: 'exercise_running',
      58: 'exercise_sailing',
      59: 'exercise_scuba_diving',
      60: 'exercise_skating',
      61: 'exercise_skiing',
      62: 'exercise_snowboarding',
      63: 'exercise_snowshoeing',
      64: 'exercise_soccer',
      65: 'exercise_softball',
      72: 'exercise_surfing',
      73: 'exercise_open_water_swimming',
      76: 'exercise_tennis',
      78: 'exercise_volleyball',
      79: 'exercise_walking',
      80: 'exercise_water_polo',
      82: 'exercise_wheelchair',
    };
    const key = keyMap[type];
    return key ? t(key) : t('exercise_unknown', { type });
  }

  private static buildHCStepsNotes(steps: number, speedKmh: number): string {
    const stepsFormatted = steps.toLocaleString(t('locale_tag'));
    const imperial = isImperialUnits();
    const speed = imperial ? kmhToMph(speedKmh).toFixed(1) : speedKmh.toFixed(1);
    const speedUnit = imperial ? t('unit_speed_imperial') : t('unit_speed_metric');
    return t('session_notes_hc_steps', { steps: stepsFormatted, speed, speedUnit });
  }

  private static buildHCExerciseNotes(
    exerciseName: string,
    durationMs: number,
    steps?: number
  ): string {
    if (steps != null && steps > 0) {
      const durationMin = durationMs / 60_000;
      const speedKmh = (steps / durationMin / STEPS_PER_MINUTE_AT_5KMH) * BASELINE_SPEED_KMH;
      return this.buildHCStepsNotes(steps, speedKmh);
    }
    return t('session_notes_hc_exercise', { exerciseName });
  }
}
