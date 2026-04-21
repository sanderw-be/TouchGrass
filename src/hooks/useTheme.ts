import { useAppStore, AppState } from '../store/useAppStore';

export function useTheme() {
  const colors = useAppStore((state: AppState) => state.colors);
  const shadows = useAppStore((state: AppState) => state.shadows);
  const isDark = useAppStore((state: AppState) => state.isDark);

  return {
    colors,
    shadows,
    isDark,
  };
}
