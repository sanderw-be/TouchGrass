import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors as lightColors, darkColors, makeShadows, Shadows } from '../utils/theme';
import { getSetting, setSetting } from '../storage/database';

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

  useEffect(() => {
    const stored = getSetting('theme_preference', 'system');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemePreferenceState(stored);
    }
  }, []);

  const setThemePreference = (pref: ThemePreference) => {
    setSetting('theme_preference', pref);
    setThemePreferenceState(pref);
  };

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && systemColorScheme === 'dark');

  const activeColors = isDark ? darkColors : lightColors;
  const activeShadows = useMemo(() => makeShadows(activeColors), [activeColors]);

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
