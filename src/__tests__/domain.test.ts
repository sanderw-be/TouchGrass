import {
  mergeSessionData,
  calculateMergedSpeed,
  splitRangeAroundConfirmed,
} from '../domain/SessionDomain';
import {
  calculateUpdatedProbability,
  scoreDuration,
  calculateSessionScore,
} from '../domain/ScoringDomain';
import {
  validateDailyGoal,
  validateWeeklyGoal,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  MIN_WEEKLY_MINUTES,
  MAX_WEEKLY_MINUTES,
} from '../domain/GoalDomain';
import { isPermissionIssue, getPermissionIssueLabels } from '../domain/ReminderDomain';
import { OutsideSession } from '../storage/types';

describe('Domain Logic', () => {
  const mockSession = (
    id: number,
    startTime: number,
    endTime: number,
    confidence: number
  ): OutsideSession => ({
    id,
    startTime,
    endTime,
    durationMinutes: (endTime - startTime) / 60000,
    source: 'gps',
    confidence,
    userConfirmed: 0,
    discarded: 0,
  });

  describe('SessionDomain', () => {
    describe('mergeSessionData', () => {
      it('merges overlapping unconfirmed sessions', () => {
        const candidate = mockSession(1, 1000, 2000, 0.5);
        candidate.steps = 100;
        candidate.distanceMeters = 500;

        const unconfirmed = [mockSession(2, 800, 1500, 0.7), mockSession(3, 1800, 2500, 0.4)];
        unconfirmed[0].steps = 50;
        unconfirmed[0].distanceMeters = 200;

        const merged = mergeSessionData(candidate, unconfirmed);

        expect(merged.startTime).toBe(800);
        expect(merged.endTime).toBe(2500);
        expect(merged.confidence).toBe(0.7);
        expect(merged.steps).toBe(150);
        expect(merged.distanceMeters).toBe(700);
      });

      it('handles sessions without steps or distance', () => {
        const candidate = mockSession(1, 1000, 2000, 0.5);
        const merged = mergeSessionData(candidate, []);
        expect(merged.steps).toBeUndefined();
        expect(merged.distanceMeters).toBeUndefined();
      });
    });

    describe('calculateMergedSpeed', () => {
      it('calculates speed from distance (precedence over steps)', () => {
        const speed = calculateMergedSpeed(3600000, 5000, 10000); // 1 hour, 5km
        expect(speed).toBe(5);
      });

      it('calculates speed from steps when distance is missing', () => {
        // 60 mins, 6600 steps => 110 steps/min => baseline 5km/h
        const speed = calculateMergedSpeed(3600000, undefined, 6600);
        expect(speed).toBe(5);
      });

      it('returns undefined for non-positive duration', () => {
        expect(calculateMergedSpeed(0, 500)).toBeUndefined();
        expect(calculateMergedSpeed(-1, 500)).toBeUndefined();
      });

      it('returns undefined if no distance or steps', () => {
        expect(calculateMergedSpeed(3600000)).toBeUndefined();
      });
    });

    describe('splitRangeAroundConfirmed', () => {
      it('splits range correctly with multiple confirmed sessions', () => {
        const rangeStart = 1000;
        const rangeEnd = 5000;
        const confirmed = [mockSession(10, 1500, 2000, 1), mockSession(11, 3000, 4000, 1)];

        const segments = splitRangeAroundConfirmed(rangeStart, rangeEnd, confirmed);

        expect(segments).toEqual([
          [1000, 1500],
          [2000, 3000],
          [4000, 5000],
        ]);
      });

      it('handles overlapping confirmed sessions by merging them conceptually via cursor', () => {
        const rangeStart = 1000;
        const rangeEnd = 5000;
        const confirmed = [mockSession(10, 1500, 2500, 1), mockSession(11, 2000, 3000, 1)];

        const segments = splitRangeAroundConfirmed(rangeStart, rangeEnd, confirmed);

        expect(segments).toEqual([
          [1000, 1500],
          [3000, 5000],
        ]);
      });

      it('returns full range if no confirmed sessions', () => {
        const segments = splitRangeAroundConfirmed(1000, 2000, []);
        expect(segments).toEqual([[1000, 2000]]);
      });

      it('excludes sessions outside the range', () => {
        const rangeStart = 1000;
        const rangeEnd = 2000;
        const confirmed = [mockSession(10, 0, 500, 1), mockSession(11, 2500, 3000, 1)];
        const segments = splitRangeAroundConfirmed(rangeStart, rangeEnd, confirmed);
        expect(segments).toEqual([[1000, 2000]]);
      });
    });
  });

  describe('ScoringDomain', () => {
    describe('calculateUpdatedProbability', () => {
      it('increases probability on confirm', () => {
        const p = calculateUpdatedProbability(0.5, true);
        expect(p).toBeCloseTo(0.55); // 0.5 + 0.1 * (1.0 - 0.5)
      });

      it('decreases probability on deny', () => {
        const p = calculateUpdatedProbability(0.5, false);
        expect(p).toBeCloseTo(0.45); // 0.5 + 0.1 * (0.0 - 0.5)
      });

      it('clamps probability between 0.1 and 0.9', () => {
        expect(calculateUpdatedProbability(0.9, true)).toBe(0.9);
        expect(calculateUpdatedProbability(0.1, false)).toBe(0.1);
        expect(calculateUpdatedProbability(0.85, true)).toBe(0.865);
        expect(calculateUpdatedProbability(0.15, false)).toBe(0.135);
      });
    });

    describe('scoreDuration', () => {
      it('returns correct factors for different durations', () => {
        expect(scoreDuration(5 * 60000)).toBe(0.3); // 5m
        expect(scoreDuration(15 * 60000)).toBe(0.7); // 15m
        expect(scoreDuration(60 * 60000)).toBe(1.0); // 1h
        expect(scoreDuration(4 * 60 * 60000)).toBe(0.8); // 4h
        expect(scoreDuration(5 * 60 * 60000)).toBe(0.4); // 5h
      });
    });

    describe('calculateSessionScore', () => {
      it('calculates overall score correctly', () => {
        const score = calculateSessionScore(0.8, 60 * 60000, 0.5);
        // base (0.8) * durationFactor (1.0) * (0.5 + prob (0.5)) = 0.8
        expect(score).toBeCloseTo(0.8);
      });

      it('clamps score between 0 and 1', () => {
        expect(calculateSessionScore(1.5, 60 * 60000, 0.9)).toBe(1);
        expect(calculateSessionScore(-1, 60 * 60000, 0.1)).toBe(0);
      });
    });
  });

  describe('GoalDomain', () => {
    describe('validateDailyGoal', () => {
      it('validates correctly within bounds', () => {
        expect(validateDailyGoal(MIN_DAILY_MINUTES)).toBe(true);
        expect(validateDailyGoal(MAX_DAILY_MINUTES)).toBe(true);
        expect(validateDailyGoal(30)).toBe(true);
      });

      it('rejects out of bounds or NaN', () => {
        expect(validateDailyGoal(MIN_DAILY_MINUTES - 1)).toBe(false);
        expect(validateDailyGoal(MAX_DAILY_MINUTES + 1)).toBe(false);
        expect(validateDailyGoal(NaN)).toBe(false);
      });
    });

    describe('validateWeeklyGoal', () => {
      it('validates correctly within bounds', () => {
        expect(validateWeeklyGoal(MIN_WEEKLY_MINUTES)).toBe(true);
        expect(validateWeeklyGoal(MAX_WEEKLY_MINUTES)).toBe(true);
        expect(validateWeeklyGoal(150)).toBe(true);
      });

      it('rejects out of bounds or NaN', () => {
        expect(validateWeeklyGoal(MIN_WEEKLY_MINUTES - 1)).toBe(false);
        expect(validateWeeklyGoal(MAX_WEEKLY_MINUTES + 1)).toBe(false);
        expect(validateWeeklyGoal(NaN)).toBe(false);
      });
    });
  });

  describe('ReminderDomain', () => {
    describe('isPermissionIssue', () => {
      it('identifies issues when enabled but no permission', () => {
        expect(isPermissionIssue(true, false)).toBe(true);
        expect(isPermissionIssue(true, true)).toBe(false);
        expect(isPermissionIssue(false, false)).toBe(false);
      });
    });

    describe('getPermissionIssueLabels', () => {
      const labels = { reminders: 'REM', weather: 'WEA', calendar: 'CAL' };

      it('returns labels only for features with issues', () => {
        const issues = getPermissionIssueLabels(
          1,
          false, // Reminders enabled, no perm
          true,
          true, // Weather enabled, with perm
          true,
          false, // Calendar enabled, no perm
          labels
        );
        expect(issues).toEqual(['REM', 'CAL']);
      });

      it('returns empty array if no issues', () => {
        const issues = getPermissionIssueLabels(2, true, false, false, false, false, labels);
        expect(issues).toEqual([]);
      });
    });
  });
});
