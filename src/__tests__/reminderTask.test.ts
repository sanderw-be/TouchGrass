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
  describe('no planned slots', () => {
    it('sleeps until midnight when there are no planned slots', () => {
      const now = todayAt(9, 0);
      const result = computeNextSleepMs([], now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3); // within ~1 second
    });
  });

  describe('upcoming planned slot', () => {
    it('sleeps until 5 minutes before the next upcoming slot', () => {
      // Now is 09:00, slot is at 10:00 → 60 minutes away → sleep 55 min
      const now = todayAt(9, 0);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(55 * 60 * 1000);
    });

    it('picks the soonest upcoming slot when multiple are present', () => {
      // Now is 09:00, slots at 10:00 and 14:00 → next is 10:00 → 55 min
      const now = todayAt(9, 0);
      const slots = [
        { hour: 14, minute: 0 },
        { hour: 10, minute: 0 },
      ];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(55 * 60 * 1000);
    });

    it('sleeps at least 1 minute even if slot is within the lead window', () => {
      // Now is 09:57, slot is at 10:00 → 3 min away, less than LEAD_MINUTES (5)
      const now = todayAt(9, 57);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(1 * 60 * 1000);
    });

    it('ignores slots that have already passed when computing the next slot', () => {
      // Now is 11:00, past slot at 10:00, upcoming slot at 14:00 → 3 h away → 175 min
      const now = todayAt(11, 0);
      const slots = [
        { hour: 10, minute: 0 },
        { hour: 14, minute: 0 },
      ];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(175 * 60 * 1000);
    });
  });

  describe('all slots have passed — catch-up window', () => {
    it('returns CATCHUP_CHECK_INTERVAL_MS when within 2 hours of last slot', () => {
      // All slots have passed, last one was at 10:00, now is 10:30 (30 min after)
      const now = todayAt(10, 30);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(5 * 60 * 1000);
    });

    it('still returns CATCHUP_CHECK_INTERVAL_MS right before the window ends', () => {
      // Last slot at 10:00, now 11:59 → 119 min after → still in window
      const now = todayAt(11, 59);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, now);

      expect(result).toBe(5 * 60 * 1000);
    });
  });

  describe('all slots have passed — past catch-up window', () => {
    it('sleeps until midnight when past the catch-up window', () => {
      // Last slot at 10:00, now 12:05 → 125 min after → outside the 120-min window
      const now = todayAt(12, 5);
      const slots = [{ hour: 10, minute: 0 }];
      const result = computeNextSleepMs(slots, now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3);
    });

    it('uses the latest slot to determine the catch-up window', () => {
      // Slots at 10:00 and 14:00, both passed, now is 16:05 → 125 min after 14:00 → outside window
      const now = todayAt(16, 5);
      const slots = [
        { hour: 10, minute: 0 },
        { hour: 14, minute: 0 },
      ];
      const result = computeNextSleepMs(slots, now);

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const expectedMs = tomorrow.getTime() - now.getTime();

      expect(result).toBeCloseTo(expectedMs, -3);
    });
  });

  describe('near midnight edge cases', () => {
    it('returns at least 60 000 ms so the loop never busy-spins near midnight', () => {
      // 23:59 with no slots → msUntilMidnight ≈ 60 s, but minimum is 1 min
      const now = todayAt(23, 59, 30);
      const result = computeNextSleepMs([], now);

      expect(result).toBeGreaterThanOrEqual(60 * 1000);
    });
  });
});
