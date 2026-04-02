export const colors = {
  // Primary greens — natural, earthy
  grass: '#4A7C59',
  grassLight: '#6BAF7A',
  grassPale: '#E8F5EC',
  grassDark: '#2D5240',

  // Accent — warm sky
  sky: '#7EB8D4',
  skyLight: '#B8DFF0',
  sun: '#F5C842',

  // Neutrals
  soil: '#2C1F14',
  bark: '#5C4033',
  sand: '#F2EDE4',
  mist: '#F8F9F7',
  fog: '#E8EBE6',

  // Semantic
  success: '#4A7C59',
  warning: '#F5C842',
  error: '#D9534F',
  inactive: '#A8B5A2',
  errorSurface: '#FEE2E2',
  warningSurface: '#FEF3C7',
  warningText: '#92400E',

  // Text
  textPrimary: '#1A2E1F',
  textSecondary: '#5A7060',
  textMuted: '#8FA892',
  textInverse: '#FFFFFF',
  card: '#FFFFFF',
};

export const darkColors: typeof colors = {
  // Primary greens — same brand identity
  grass: '#5A9E6F',
  grassLight: '#6BAF7A',
  grassPale: '#1A3320',
  grassDark: '#4A8060',

  // Accent — warm sky
  sky: '#7EB8D4',
  skyLight: '#4A7A8C',
  sun: '#F5C842',

  // Neutrals
  soil: '#D0C8C0',
  bark: '#A08070',
  sand: '#1E2820',
  mist: '#121C14',
  fog: '#2A3D2E',

  // Semantic
  success: '#5A9E6F',
  warning: '#F5C842',
  error: '#EF6B67',
  inactive: '#5A7060',
  errorSurface: '#3D1A1A',
  warningSurface: '#2D2806',
  warningText: '#D4A843',

  // Text
  textPrimary: '#E4EFE7',
  textSecondary: '#9DB8A2',
  textMuted: '#6B8A6F',
  textInverse: '#FFFFFF',
  card: '#1E2820',
};

export const fonts = {
  // Display — characterful, nature-inspired (Nunito loaded via expo-font)
  display: 'Nunito_700Bold',
  displayLight: 'Nunito_400Regular',
  displaySemiBold: 'Nunito_600SemiBold',
  displayExtraBold: 'Nunito_800ExtraBold',
  body: 'Nunito_400Regular',
  bodySemiBold: 'Nunito_600SemiBold',
  mono: 'monospace',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 9999,
};

export type ThemeColors = typeof colors;

export type Shadows = {
  soft: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  medium: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

export function makeShadows(themeColors: ThemeColors): Shadows {
  return {
    soft: {
      shadowColor: themeColors.grassDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    medium: {
      shadowColor: themeColors.grassDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  };
}

export const shadows = makeShadows(colors);

// Progress ring helper
export function progressColor(percent: number): string {
  if (percent >= 1) return colors.grassLight;
  if (percent >= 0.6) return colors.grass;
  if (percent >= 0.3) return colors.sun;
  return colors.sky;
}
