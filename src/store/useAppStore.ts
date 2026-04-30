import { create } from 'zustand';
import { ColorSchemeName } from 'react-native';
import {
  colors as lightColors,
  darkColors,
  makeShadows,
  Shadows,
  ThemeColors,
} from '../utils/theme';
import { getSettingAsync, setSettingAsync } from '../storage';
import i18n, { getDeviceSupportedLocale, TxKey } from '../i18n';
import {
  performCriticalInitializationAsync,
  performDeferredInitialization,
} from '../../appBootstrap';

export type ThemePreference = 'system' | 'light' | 'dark';
export type FeedbackAction = 'went_outside' | 'snoozed' | 'less_often';

export interface FeedbackModalData {
  action: FeedbackAction;
  hour: number;
  minute: number;
  /** Not required for 'less_often' — that action shows a two-choice picker instead of a confirmation. */
  confirmBodyKey?: TxKey;
}

export interface AppState {
  // Initialization
  isReady: boolean;
  deferredInitDone: boolean;

  // Language
  locale: string;

  // Intro
  showIntro: boolean;

  // Theme
  themePreference: ThemePreference;
  systemColorScheme: ColorSchemeName;
  colors: ThemeColors;
  shadows: Shadows;
  isDark: boolean;

  // Reminder Feedback
  feedbackVisible: boolean;
  feedbackData: FeedbackModalData | null;

  // Actions
  initialize: (systemScheme: ColorSchemeName) => Promise<void>;
  setLocale: (code: string) => void;
  handleShowIntro: () => void;
  handleIntroComplete: () => void;
  setThemePreference: (pref: ThemePreference) => void;
  setSystemColorScheme: (scheme: ColorSchemeName) => void;
  dismissFeedback: () => void;
  triggerFeedback: (data: FeedbackModalData) => void;
  reset: () => void;
}

const calculateTheme = (pref: ThemePreference, systemScheme: ColorSchemeName) => {
  const isDark = pref === 'dark' || (pref === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;
  const shadows = makeShadows(colors);
  return { isDark, colors, shadows };
};

const initialState = {
  isReady: false,
  deferredInitDone: false,
  locale: 'system',
  showIntro: true,
  themePreference: 'system' as ThemePreference,
  systemColorScheme: 'light' as ColorSchemeName,
  colors: lightColors,
  shadows: makeShadows(lightColors),
  isDark: false,
  feedbackVisible: false,
  feedbackData: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  initialize: async (systemScheme: ColorSchemeName) => {
    try {
      const { showIntro: initialShowIntro, initialLocale } =
        await performCriticalInitializationAsync();

      const storedTheme = await getSettingAsync('theme_preference', 'system');
      const themePref =
        storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
          ? (storedTheme as ThemePreference)
          : 'system';

      const themeState = calculateTheme(themePref, systemScheme);

      set({
        isReady: true,
        showIntro: initialShowIntro,
        locale: initialLocale,
        themePreference: themePref,
        systemColorScheme: systemScheme,
        ...themeState,
      });

      // Trigger deferred init if not showing intro
      if (!initialShowIntro) {
        set({ deferredInitDone: true });
        performDeferredInitialization();
      }
    } catch (error) {
      console.error('[AppStore] Initialization failed:', error);
      set({ isReady: true });
    }
  },

  setLocale: (code: string) => {
    const languagePreference = code === 'system' ? 'system' : code;
    i18n.locale = languagePreference === 'system' ? getDeviceSupportedLocale() : languagePreference;
    setSettingAsync('language', languagePreference).catch((err) =>
      console.error('[AppStore] Failed to save language preference:', err)
    );
    set({ locale: languagePreference });
  },

  handleShowIntro: () => {
    setSettingAsync('hasCompletedIntro', '0').catch((err) =>
      console.error('[AppStore] Failed to reset intro status:', err)
    );
    set({ showIntro: true });
  },

  handleIntroComplete: () => {
    setSettingAsync('hasCompletedIntro', '1').catch((err) =>
      console.error('[AppStore] Failed to save intro completion:', err)
    );

    const { deferredInitDone } = get();
    set({ showIntro: false });

    if (!deferredInitDone) {
      set({ deferredInitDone: true });
      performDeferredInitialization();
    }
  },

  setThemePreference: (pref: ThemePreference) => {
    setSettingAsync('theme_preference', pref).catch((err) =>
      console.error('[AppStore] Failed to save theme preference:', err)
    );
    const { systemColorScheme } = get();
    const themeState = calculateTheme(pref, systemColorScheme);
    set({ themePreference: pref, ...themeState });
  },

  setSystemColorScheme: (scheme: ColorSchemeName) => {
    const { themePreference } = get();
    const themeState = calculateTheme(themePreference, scheme);
    set({ systemColorScheme: scheme, ...themeState });
  },

  dismissFeedback: () => set({ feedbackVisible: false }),

  triggerFeedback: (data: FeedbackModalData) => {
    console.log('[AppStore] Triggering feedback modal:', data.action);
    set({ feedbackVisible: true, feedbackData: data });
  },

  reset: () => set(initialState),
}));
