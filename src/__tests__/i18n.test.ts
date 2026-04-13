const mockGetLocales = jest.fn(() => [{ languageCode: 'en', regionCode: 'US', languageTag: 'en-US' }]);

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

// Mock react-native-localize
const mockUses24HourClock = jest.fn(() => true);
jest.mock('react-native-localize', () => ({
  uses24HourClock: () => mockUses24HourClock(),
}));

import { formatLocalTime, getDeviceSupportedLocale, resolveSupportedLocale } from '../i18n';

describe('formatLocalTime', () => {
  it('omits AM/PM in 24-hour mode', () => {
    mockUses24HourClock.mockReturnValue(true);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).not.toMatch(/am|pm/i);
  });

  it('uses compact lowercase am/pm without spaces or dots in 12-hour mode', () => {
    mockUses24HourClock.mockReturnValue(false);
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).toMatch(/\d+:\d+(am|pm)/);
  });

  it('always includes hours and minutes', () => {
    mockUses24HourClock.mockReturnValue(true);
    const timestamp = new Date('2024-01-15T09:05:00').getTime();
    const formatted = formatLocalTime(timestamp);
    expect(formatted).toMatch(/\d+/);
  });
});

describe('locale resolution', () => {
  it('resolves Brazilian Portuguese locale tags exactly', () => {
    expect(resolveSupportedLocale('pt-BR')).toBe('pt-BR');
  });

  it('falls back to base Portuguese for unsupported Portuguese variants', () => {
    expect(resolveSupportedLocale('pt-PT')).toBe('pt');
  });

  it('detects pt-BR from the device locale', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'pt', regionCode: 'BR', languageTag: 'pt-BR' }]);
    expect(getDeviceSupportedLocale()).toBe('pt-BR');
  });
});
