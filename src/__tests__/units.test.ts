// Mock expo-localization before importing the module under test
const mockGetLocales = jest.fn(() => [{ languageCode: 'en', regionCode: 'US' as string | null }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

import { isImperialUnits, kmToMiles, kmhToMph } from '../utils/units';

describe('kmToMiles', () => {
  it('converts 1 km to ~0.621 miles', () => {
    expect(kmToMiles(1)).toBeCloseTo(0.621371);
  });

  it('converts 5 km to ~3.107 miles', () => {
    expect(kmToMiles(5)).toBeCloseTo(3.10686);
  });

  it('converts 0 km to 0 miles', () => {
    expect(kmToMiles(0)).toBe(0);
  });
});

describe('kmhToMph', () => {
  it('converts 5 km/h to ~3.107 mph', () => {
    expect(kmhToMph(5)).toBeCloseTo(3.10686);
  });

  it('converts 100 km/h to ~62.14 mph', () => {
    expect(kmhToMph(100)).toBeCloseTo(62.1371);
  });

  it('converts 0 km/h to 0 mph', () => {
    expect(kmhToMph(0)).toBe(0);
  });
});

describe('isImperialUnits', () => {
  it('returns true for US region', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);
    expect(isImperialUnits()).toBe(true);
  });

  it('returns true for GB (United Kingdom)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'GB' }]);
    expect(isImperialUnits()).toBe(true);
  });

  it('returns true for US territory Guam (GU)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'GU' }]);
    expect(isImperialUnits()).toBe(true);
  });

  it('returns true for US territory Puerto Rico (PR)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'PR' }]);
    expect(isImperialUnits()).toBe(true);
  });

  it('returns false for Netherlands (NL)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'nl', regionCode: 'NL' }]);
    expect(isImperialUnits()).toBe(false);
  });

  it('returns false for Germany (DE)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'de', regionCode: 'DE' }]);
    expect(isImperialUnits()).toBe(false);
  });

  it('returns false for Australia (AU)', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'AU' }]);
    expect(isImperialUnits()).toBe(false);
  });

  it('returns false when region code is null', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: null }]);
    expect(isImperialUnits()).toBe(false);
  });

  it('returns false when getLocales returns empty array', () => {
    mockGetLocales.mockReturnValue([]);
    expect(isImperialUnits()).toBe(false);
  });
});
