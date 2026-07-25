import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { UseThemeReturn } from './themeTypes';

export type { Theme, ThemePreference, UseThemeReturn } from './themeTypes';
export { getEffectiveTheme } from './themeTypes';

/**
 * Hook to get theme-aware colors and the effective theme.
 * Reads from the root ThemeProvider (single preference fetch + Appearance listener).
 */
export function useTheme(): UseThemeReturn {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
