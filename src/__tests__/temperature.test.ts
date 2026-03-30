// Mock expo-localization
const mockGetLocales = jest.fn(() => [{ languageCode: 'en', regionCode: 'US' as string | null }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

import { useFahrenheit, celsiusToFahrenheit, formatTemperature } from '../utils/temperature';

describe('celsiusToFahrenheit', () => {
  it('converts 0°C to 32°F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it('converts 100°C to 212°F', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it('converts -40°C to -40°F', () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it('converts 22°C correctly', () => {
    expect(celsiusToFahrenheit(22)).toBeCloseTo(71.6);
  });
});

describe('useFahrenheit', () => {
  it('returns true for US region', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);
    expect(useFahrenheit()).toBe(true);
  });

  it('returns true for Liberia (LR)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'LR' }]);
    expect(useFahrenheit()).toBe(true);
  });

  it('returns true for Myanmar (MM)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'my', regionCode: 'MM' }]);
    expect(useFahrenheit()).toBe(true);
  });

  it('returns true for US territory Guam (GU)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'GU' }]);
    expect(useFahrenheit()).toBe(true);
  });

  it('returns false for Netherlands (NL)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'nl', regionCode: 'NL' }]);
    expect(useFahrenheit()).toBe(false);
  });

  it('returns false for Germany (DE)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'de', regionCode: 'DE' }]);
    expect(useFahrenheit()).toBe(false);
  });

  it('returns false when region code is null', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: null }]);
    expect(useFahrenheit()).toBe(false);
  });

  it('returns false when getLocales returns empty array', () => {
    mockGetLocales.mockReturnValue([]);
    expect(useFahrenheit()).toBe(false);
  });
});

describe('formatTemperature', () => {
  it('formats temperature in Fahrenheit for US region', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);
    expect(formatTemperature(22)).toBe('72°F');
  });

  it('formats temperature in Celsius for NL region', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'nl', regionCode: 'NL' }]);
    expect(formatTemperature(22)).toBe('22°C');
  });

  it('rounds Fahrenheit to nearest integer', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);
    // 20°C = 68°F exactly
    expect(formatTemperature(20)).toBe('68°F');
  });

  it('rounds Celsius to nearest integer', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'nl', regionCode: 'NL' }]);
    expect(formatTemperature(22.7)).toBe('23°C');
  });

  it('handles negative temperatures in Celsius', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'nl', regionCode: 'NL' }]);
    expect(formatTemperature(-5)).toBe('-5°C');
  });

  it('handles negative temperatures in Fahrenheit', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);
    expect(formatTemperature(-10)).toBe('14°F');
  });
});
