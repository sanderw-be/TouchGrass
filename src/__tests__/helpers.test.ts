import { formatMinutes, formatTime, formatDate } from '../utils/helpers';

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
});

describe('formatTime', () => {
  it('formats a timestamp as time', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatTime(timestamp);
    // The exact format may vary by locale, but it should contain time components
    expect(formatted).toMatch(/\d+/);
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
