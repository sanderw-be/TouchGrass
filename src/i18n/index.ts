import { I18n } from 'i18n-js';
import * as ExpoLocalization from 'expo-localization';
import en from './en';
import nl from './nl';

const i18n = new I18n({ en, nl });

// Detect device locale, fall back to English
const deviceLocale = ExpoLocalization.getLocales?.()?.[0]?.languageCode ?? 'en';
i18n.locale = ['en', 'nl'].includes(deviceLocale) ? deviceLocale : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;

// Shorthand translate function
export function t(key: string, options?: Record<string, any>): string {
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

// Format a time using the current locale
export function formatLocalTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// To add a new language:
// 1. Create src/i18n/[code].ts (copy en.ts as template)
// 2. Import it here and add to the i18n translations object
// 3. Add the language code to the supported list in the locale detection line
