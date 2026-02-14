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

  // Text
  textPrimary: '#1A2E1F',
  textSecondary: '#5A7060',
  textMuted: '#8FA892',
  textInverse: '#FFFFFF',
};

export const fonts = {
  // Display — characterful, nature-inspired
  display: 'serif',          // fallback; we'll load custom fonts later
  body: 'System',
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

export const shadows = {
  soft: {
    shadowColor: colors.grassDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  medium: {
    shadowColor: colors.grassDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Progress ring helper
export function progressColor(percent: number): string {
  if (percent >= 1) return colors.grassLight;
  if (percent >= 0.6) return colors.grass;
  if (percent >= 0.3) return colors.sun;
  return colors.sky;
}

// Format minutes as human-readable
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Format a timestamp as a readable time
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format a timestamp as a readable date
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
