import * as ExpoLocalization from 'expo-localization';

/**
 * Region codes that use Fahrenheit as the primary temperature unit.
 * This includes the United States, its territories, and a few other countries.
 */
const FAHRENHEIT_REGIONS = new Set([
  'US', // United States
  'LR', // Liberia
  'MM', // Myanmar
  'KY', // Cayman Islands
  'PR', // Puerto Rico (US territory)
  'GU', // Guam (US territory)
  'VI', // US Virgin Islands (US territory)
  'AS', // American Samoa (US territory)
  'MP', // Northern Mariana Islands (US territory)
]);

/**
 * Returns true if the device's regional setting uses Fahrenheit.
 * Falls back to Celsius if the region cannot be determined.
 *
 * Note: `getLocales?.()` uses optional chaining because the API may not be
 * available in all environments (e.g., during server-side rendering or in
 * certain test contexts). The fallback is an empty array, which results in
 * Celsius being used by default.
 */
export function isFahrenheit(): boolean {
  const locales = ExpoLocalization.getLocales?.() ?? [];
  const regionCode = locales[0]?.regionCode ?? null;
  return regionCode !== null && FAHRENHEIT_REGIONS.has(regionCode);
}

/**
 * Converts a Celsius value to Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/**
 * Formats a temperature (given in Celsius) as a string using the
 * appropriate unit for the device's region (°C or °F).
 */
export function formatTemperature(celsius: number): string {
  if (isFahrenheit()) {
    return `${Math.round(celsiusToFahrenheit(celsius))}°F`;
  }
  return `${Math.round(celsius)}°C`;
}
