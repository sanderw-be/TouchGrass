import { formatLocalTime } from '../i18n';

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', regionCode: 'US' }]),
}));

// Mock react-native-localize
const mockUses24HourClock = jest.fn(() => true);
jest.mock('react-native-localize', () => ({
  uses24HourClock: () => mockUses24HourClock(),
}));

describe('formatLocalTime', () => {
  it('omits AM/PM in 24-hour mode', () => {
    mockUses24HourClock.mockReturnValue(true);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).not.toMatch(/AM|PM/i);
  });

  it('includes AM/PM in 12-hour mode', () => {
    mockUses24HourClock.mockReturnValue(false);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).toMatch(/AM|PM/i);
  });

  it('always includes hours and minutes', () => {
    mockUses24HourClock.mockReturnValue(true);
    const timestamp = new Date('2024-01-15T09:05:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).toMatch(/\d+/);
  });
});
