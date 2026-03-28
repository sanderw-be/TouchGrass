import { formatMinutes, formatTime, formatDate, formatTimer, uses24HourClock, normalizeAmPm } from '../utils/helpers';

// Mock react-native-localize for helpers tests
const mockUses24HourClock = jest.fn(() => true);
jest.mock('react-native-localize', () => ({
  uses24HourClock: () => mockUses24HourClock(),
}));

describe('formatMinutes', () => {
  it('formats minutes less than 60', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(15)).toBe('15m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(59)).toBe('59m');
  });

  it('formats hours without minutes', () => {
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(180)).toBe('3h');
  });

  it('formats hours with minutes', () => {
    expect(formatMinutes(65)).toBe('1h 5m');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(125)).toBe('2h 5m');
  });

  it('rounds fractional minutes', () => {
    expect(formatMinutes(15.4)).toBe('15m');
    expect(formatMinutes(15.6)).toBe('16m');
    expect(formatMinutes(65.4)).toBe('1h 5m');
  });

  it('propagates minute rounding to hours (no 1h 60m)', () => {
    // 119 min 50 sec = 119.833... min → rounds to 120 min → 2h
    expect(formatMinutes(119.833)).toBe('2h');
    // 59.5 min → rounds to 60 → 1h
    expect(formatMinutes(59.5)).toBe('1h');
    // 89.5 min → rounds to 90 → 1h 30m
    expect(formatMinutes(89.5)).toBe('1h 30m');
  });
});

describe('formatTime', () => {
  it('formats a timestamp as time', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatTime(timestamp);
    // The exact format may vary by locale, but it should contain time components
    expect(formatted).toMatch(/\d+/);
  });

  it('omits AM/PM in 24-hour mode', () => {
    mockUses24HourClock.mockReturnValue(true);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatTime(timestamp);
    expect(formatted).not.toMatch(/am|pm/i);
  });

  it('uses compact lowercase am/pm without spaces or dots in 12-hour mode', () => {
    mockUses24HourClock.mockReturnValue(false);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatTime(timestamp);
    expect(formatted).toMatch(/\d+:\d+(am|pm)/);
  });
});

describe('formatDate', () => {
  it('formats a timestamp as date', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatDate(timestamp);
    // The exact format may vary by locale, but it should contain date components
    expect(formatted).toMatch(/\w+/);
  });
});

describe('formatTimer', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(65)).toBe('01:05');
    expect(formatTimer(599)).toBe('09:59');
  });

  it('formats seconds as H:MM:SS when >= 1 hour', () => {
    expect(formatTimer(3600)).toBe('1:00:00');
    expect(formatTimer(3661)).toBe('1:01:01');
    expect(formatTimer(7325)).toBe('2:02:05');
  });
});

describe('uses24HourClock', () => {
  it('returns true when device uses 24-hour clock', () => {
    mockUses24HourClock.mockReturnValue(true);
    expect(uses24HourClock()).toBe(true);
  });

  it('returns false when device uses 12-hour clock', () => {
    mockUses24HourClock.mockReturnValue(false);
    expect(uses24HourClock()).toBe(false);
  });
});

describe('normalizeAmPm', () => {
  it('strips space and dots from "a.m."', () => {
    expect(normalizeAmPm('10:02 a.m.')).toBe('10:02am');
  });

  it('strips space and dots from "p.m."', () => {
    expect(normalizeAmPm('2:30 p.m.')).toBe('2:30pm');
  });

  it('strips space from uppercase "AM"', () => {
    expect(normalizeAmPm('10:02 AM')).toBe('10:02am');
  });

  it('strips space from uppercase "PM"', () => {
    expect(normalizeAmPm('2:30 PM')).toBe('2:30pm');
  });

  it('leaves 24h strings unchanged', () => {
    expect(normalizeAmPm('14:30')).toBe('14:30');
  });
});
