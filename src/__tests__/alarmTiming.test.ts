/**
 * Tests for alarmTiming helpers (Pulsar chained-alarm architecture).
 */

jest.mock('alarm-bridge-native', () => ({
  scheduleNextPulse: jest.fn(() => Promise.resolve()),
  cancelPulse: jest.fn(() => Promise.resolve()),
  PULSE_TASK_NAME: 'TOUCHGRASS_PULSE_TASK',
}));

import * as AlarmBridgeNative from 'alarm-bridge-native';
import {
  computeNextSleepMs,
  scheduleNextAlarmPulse,
  cancelAlarmPulse,
  PULSE_INTERVAL_DAY_MS,
  PULSE_INTERVAL_NIGHT_MS,
} from '../background/alarmTiming';

describe('alarmTiming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeNextSleepMs', () => {
    it('returns the day interval during active hours (06:00)', () => {
      const now = new Date('2024-01-01T06:00:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_DAY_MS);
    });

    it('returns the day interval at noon', () => {
      const now = new Date('2024-01-01T12:00:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_DAY_MS);
    });

    it('returns the day interval at 23:59', () => {
      const now = new Date('2024-01-01T23:59:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_DAY_MS);
    });

    it('returns the night interval at midnight (00:00)', () => {
      const now = new Date('2024-01-01T00:00:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_NIGHT_MS);
    });

    it('returns the night interval at 03:00', () => {
      const now = new Date('2024-01-01T03:00:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_NIGHT_MS);
    });

    it('returns the night interval at 05:59', () => {
      const now = new Date('2024-01-01T05:59:00');
      expect(computeNextSleepMs(now)).toBe(PULSE_INTERVAL_NIGHT_MS);
    });

    it('day interval is 15 minutes', () => {
      expect(PULSE_INTERVAL_DAY_MS).toBe(15 * 60 * 1000);
    });

    it('night interval is 60 minutes', () => {
      expect(PULSE_INTERVAL_NIGHT_MS).toBe(60 * 60 * 1000);
    });
  });

  describe('scheduleNextAlarmPulse', () => {
    it('calls scheduleNextPulse with the day interval during active hours', async () => {
      const now = new Date('2024-01-01T10:00:00');
      await scheduleNextAlarmPulse(now);
      expect(AlarmBridgeNative.scheduleNextPulse).toHaveBeenCalledWith(PULSE_INTERVAL_DAY_MS);
    });

    it('calls scheduleNextPulse with the night interval during quiet hours', async () => {
      const now = new Date('2024-01-01T02:00:00');
      await scheduleNextAlarmPulse(now);
      expect(AlarmBridgeNative.scheduleNextPulse).toHaveBeenCalledWith(PULSE_INTERVAL_NIGHT_MS);
    });

    it('uses the current time when no date is provided', async () => {
      await scheduleNextAlarmPulse();
      expect(AlarmBridgeNative.scheduleNextPulse).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelAlarmPulse', () => {
    it('delegates to cancelPulse from alarm-bridge-native', async () => {
      await cancelAlarmPulse();
      expect(AlarmBridgeNative.cancelPulse).toHaveBeenCalledTimes(1);
    });
  });
});
