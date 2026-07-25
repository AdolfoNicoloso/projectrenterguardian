import type { ThemeColors } from './colors';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'auto';

/**
 * Get the effective theme (light or dark) based on user preferences
 * and system theme.
 */
export function getEffectiveTheme(
  userPreference: ThemePreference | null,
  systemColorScheme: 'light' | 'dark' | null | undefined
): Theme {
  if (userPreference === 'light') {
    return 'light';
  }
  if (userPreference === 'dark') {
    return 'dark';
  }
  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export interface UseThemeReturn {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference | null;
  isLoading: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
}
