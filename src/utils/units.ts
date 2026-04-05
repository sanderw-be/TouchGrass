import * as ExpoLocalization from 'expo-localization';

/**
 * Region codes that use the imperial measurement system (miles, mph) for
 * distance and speed. Includes the United States, the United Kingdom, and
 * all US territories.
 */
const IMPERIAL_REGIONS = new Set([
  'US', // United States
  'GB', // United Kingdom (miles on roads and mph for speed limits)
  'PR', // Puerto Rico (US territory)
  'GU', // Guam (US territory)
  'VI', // US Virgin Islands (US territory)
  'AS', // American Samoa (US territory)
  'MP', // Northern Mariana Islands (US territory)
  'UM', // US Minor Outlying Islands (US territory)
]);

/**
 * Returns true if the device's regional setting uses the imperial measurement
 * system (miles and mph). Falls back to metric if the region cannot be
 * determined.
 *
 * Note: `getLocales?.()` uses optional chaining because the API may not be
 * available in all environments (e.g., during server-side rendering or in
 * certain test contexts). The fallback is an empty array, which results in
 * metric being used by default.
 */
export function isImperialUnits(): boolean {
  const locales = ExpoLocalization.getLocales?.() ?? [];
  const regionCode = locales[0]?.regionCode ?? null;
  return regionCode !== null && IMPERIAL_REGIONS.has(regionCode);
}

/** Converts metres to yards. */
export function metersToYards(m: number): number {
  return m * 1.09361;
}

/** Converts yards to metres. */
export function yardsToMeters(yd: number): number {
  return yd / 1.09361;
}

/** Converts kilometres to miles. */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/** Converts kilometres per hour to miles per hour. */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}
