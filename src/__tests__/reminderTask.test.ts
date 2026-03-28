jest.mock('react-native-background-actions', () => ({
  isRunning: jest.fn(),
}));

jest.mock('../notifications/notificationManager', () => ({
  scheduleDayReminders: jest.fn(),
  maybeScheduleCatchUpReminder: jest.fn(),
  scheduleNextReminder: jest.fn(),
}));

jest.mock('../storage/database', () => ({
  getSetting: jest.fn(() => '[]'),
}));

import { computeNextSleepMs } from '../background/reminderTask';

// Helper to build a Date for a specific time today
function todayAt(hour: number, minute: number, second = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d;
}

describe('computeNextSleepMs', () => {
  describe('no planned slots, no catch-up slot', () => {
    it('sleeps until midnight', () => {
      const now = todayAt(9, 0);
      const result = computeNextSleepMs([], null, now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3);
    });
  });

  describe('upcoming planned slot', () => {
    it('sleeps until 5 minutes before the next upcoming slot', () => {
      // Now is 09:00, slot is at 10:00 → 60 minutes away → sleep 55 min
      const now = todayAt(9, 0);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, null, now);

      expect(result).toBe(55 * 60 * 1000);
    });

    it('picks the soonest upcoming slot when multiple are present', () => {
      // Now is 09:00, slots at 10:00 and 14:00 → next is 10:00 → 55 min
      const now = todayAt(9, 0);
      const slots = [
        { hour: 14, minute: 0 },
        { hour: 10, minute: 0 },
      ];
      const result = computeNextSleepMs(slots, null, now);

      expect(result).toBe(55 * 60 * 1000);
    });

    it('sleeps at least 1 minute even if slot is within the lead window', () => {
      // Now is 09:57, slot is at 10:00 → 3 min away, less than LEAD_MINUTES (5)
      const now = todayAt(9, 57);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, null, now);

      expect(result).toBe(1 * 60 * 1000);
    });

    it('ignores slots that have already passed when computing the next slot', () => {
      // Now is 11:00, past slot at 10:00, upcoming slot at 14:00 → 3 h away → 175 min
      const now = todayAt(11, 0);
      const slots = [
        { hour: 10, minute: 0 },
        { hour: 14, minute: 0 },
      ];
      const result = computeNextSleepMs(slots, null, now);

      expect(result).toBe(175 * 60 * 1000);
    });

    it('ignores a catch-up slot when a planned slot is still upcoming', () => {
      // Planned slot at 14:00, catch-up slot at 16:00; now is 11:00 → sleep 175 min
      const now = todayAt(11, 0);
      const slots = [{ hour: 14, minute: 0 }];
      const catchupSlot = { hour: 16, minute: 0 };
      const result = computeNextSleepMs(slots, catchupSlot, now);

      expect(result).toBe(175 * 60 * 1000);
    });
  });

  describe('all planned slots have passed — catch-up slot scheduled', () => {
    it('sleeps until 5 minutes before the catch-up slot', () => {
      // Planned slot at 10:00 has passed; catch-up at 13:00; now is 10:30 → 150 min until catch-up → sleep 145 min
      const now = todayAt(10, 30);
      const slots = [{ hour: 10, minute: 0 }];
      const catchupSlot = { hour: 13, minute: 0 };
      const result = computeNextSleepMs(slots, catchupSlot, now);

      expect(result).toBe(145 * 60 * 1000);
    });

    it('applies the 1-minute floor when catch-up is within the lead window', () => {
      // Catch-up at 10:30, now is 10:27 → 3 min away < LEAD_MINUTES(5)
      const now = todayAt(10, 27);
      const slots = [{ hour: 10, minute: 0 }];
      const catchupSlot = { hour: 10, minute: 30 };
      const result = computeNextSleepMs(slots, catchupSlot, now);

      expect(result).toBe(1 * 60 * 1000);
    });

    it('sleeps until midnight when the catch-up slot has already passed', () => {
      // Planned slot at 10:00, catch-up at 11:00, now is 12:00 — catch-up already fired
      const now = todayAt(12, 0);
      const slots = [{ hour: 10, minute: 0 }];
      const catchupSlot = { hour: 11, minute: 0 };
      const result = computeNextSleepMs(slots, catchupSlot, now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3);
    });
  });

  describe('all planned slots have passed — no catch-up scheduled', () => {
    it('sleeps until midnight', () => {
      const now = todayAt(10, 30);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, null, now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3);
    });
  });

  describe('near midnight edge cases', () => {
    it('returns at least 60 000 ms so the loop never busy-spins near midnight', () => {
      const now = todayAt(23, 59, 30);
      const result = computeNextSleepMs([], null, now);

      expect(result).toBeGreaterThanOrEqual(60 * 1000);
    });
  });
});
