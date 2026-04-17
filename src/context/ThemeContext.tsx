import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors as lightColors, darkColors, makeShadows, Shadows } from '../utils/theme';
import { getSettingAsync, setSettingAsync } from '../storage/database';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeContextType {
  colors: typeof lightColors;
  shadows: Shadows;
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  shadows: makeShadows(lightColors),
  isDark: false,
  themePreference: 'system',
  setThemePreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  useEffect(() => {
    async function loadTheme() {
      try {
        const stored = await getSettingAsync('theme_preference', 'system');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored as ThemePreference);
        }
      } catch (error) {
        console.error('[ThemeContext] Failed to load theme preference:', error);
      } finally {
        setIsThemeLoading(false);
      }
    }
    loadTheme();
  }, []);

  const setThemePreference = (pref: ThemePreference) => {
    setSettingAsync('theme_preference', pref).catch((err) =>
      console.error('[ThemeContext] Failed to save theme preference:', err)
    );
    setThemePreferenceState(pref);
  };

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && systemColorScheme === 'dark');

  const activeColors = isDark ? darkColors : lightColors;
  const activeShadows = useMemo(() => makeShadows(activeColors), [activeColors]);

  if (isThemeLoading) {
    return null; // Or a splash screen, but null is usually fine if App handles its own ready state
  }

  return (
    <ThemeContext.Provider
      value={{
        colors: activeColors,
        shadows: activeShadows,
        isDark,
        themePreference,
        setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
