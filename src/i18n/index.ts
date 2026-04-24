import { I18n } from 'i18n-js';
import * as ExpoLocalization from 'expo-localization';
import { uses24HourClock, normalizeAmPm } from '../utils/helpers';
import en, { TranslationType } from './en';
import nl from './nl';
import de from './de';
import es from './es';
import pt from './pt';
import ptBR from './pt-BR';
import fr from './fr';
import ja from './ja';

/**
 * Extract all nested paths from a translation object.
 * e.g. { home: { title: 'Home' } } -> 'home.title'
 */
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & string]: TObj[TKey] extends object
    ? `${TKey}` | `${TKey}.${RecursiveKeyOf<TObj[TKey]>}`
    : `${TKey}`;
}[keyof TObj & string];

export type TxKey = RecursiveKeyOf<TranslationType>;

export const SUPPORTED_LOCALES = ['en', 'nl', 'de', 'es', 'pt', 'pt-BR', 'fr', 'ja'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function normalizeLocaleCode(localeCode?: string | null): string | null {
  if (!localeCode) return null;

  const [languageCode, regionCode] = localeCode.split(/[-_]/);
  if (!languageCode) return null;

  return regionCode
    ? `${languageCode.toLowerCase()}-${regionCode.toUpperCase()}`
    : languageCode.toLowerCase();
}

export function resolveSupportedLocale(localeCode?: string | null): SupportedLocale {
  const normalizedLocaleCode = normalizeLocaleCode(localeCode);
  if (normalizedLocaleCode && SUPPORTED_LOCALES.includes(normalizedLocaleCode as SupportedLocale)) {
    return normalizedLocaleCode as SupportedLocale;
  }

  const baseLocaleCode = normalizedLocaleCode?.split('-')[0];
  if (baseLocaleCode && SUPPORTED_LOCALES.includes(baseLocaleCode as SupportedLocale)) {
    return baseLocaleCode as SupportedLocale;
  }

  return 'en';
}

export function getDeviceSupportedLocale(): SupportedLocale {
  const deviceLocale = ExpoLocalization.getLocales?.()?.[0];
  return resolveSupportedLocale(
    deviceLocale?.languageTag ??
      (deviceLocale?.languageCode && deviceLocale?.regionCode
        ? `${deviceLocale.languageCode}-${deviceLocale.regionCode}`
        : deviceLocale?.languageCode)
  );
}

const i18n = new I18n({
  en,
  nl,
  de,
  es,
  pt,
  // Brazilian Portuguese inherits Portugal Portuguese strings unless it overrides them here.
  'pt-BR': { ...pt, ...ptBR },
  fr,
  ja,
});

// Detect device locale, fall back to English
i18n.locale = getDeviceSupportedLocale();
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;

// Shorthand translate function
export function t(key: TxKey, options?: Record<string, unknown>): string;
export function t(key: string, options?: Record<string, unknown>): string; // Allow dynamic strings
export function t(key: TxKey | string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

// Get the locale tag for date/time formatting (e.g. 'nl-NL', 'en-GB')
export function localeTag(): string {
  return i18n.t('locale_tag');
}

// Format a date using the current locale
export function formatLocalDate(ms: number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(localeTag(), options);
}

// Format a time using the current locale, respecting the device's 12/24h setting
export function formatLocalTime(ms: number): string {
  const raw = new Date(ms).toLocaleTimeString(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !uses24HourClock(),
  });
  return uses24HourClock() ? raw : normalizeAmPm(raw);
}

// To add a new language:
// 1. Create src/i18n/[code].ts (copy en.ts as template)
// 2. Import it here and add to the i18n translations object
// 3. Add the language code to the supported list in the locale detection line
