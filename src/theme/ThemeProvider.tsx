import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { userPreferencesService } from '../services/userPreferencesService';
import { useAuthStore } from '../state/authStore';
import type { UserPreferences } from '../types';
import { lightColors, darkColors, type ThemeColors } from './colors';
import {
  getEffectiveTheme,
  type Theme,
  type ThemePreference,
  type UseThemeReturn,
} from './themeTypes';

export const ThemeContext = createContext<UseThemeReturn | null>(null);

function getThemeColors(theme: Theme): ThemeColors {
  return (theme === 'dark' ? darkColors : lightColors) as ThemeColors;
}

/**
 * Single shared theme state for the app tree.
 * Avoids per-component preference fetches and Appearance listeners.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark' | null>(
    () => {
      const scheme = Appearance.getColorScheme();
      return scheme === 'dark' || scheme === 'light' ? scheme : null;
    }
  );

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      setUserPreferences(null);
      return;
    }

    let mounted = true;

    const loadPreferences = async () => {
      try {
        const prefs = await userPreferencesService.getUserPreferences();
        if (mounted) {
          setUserPreferences(prefs);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Authentication required')) {
          console.warn(
            'Error loading user preferences, using system theme:',
            error
          );
        }
        if (mounted) {
          setUserPreferences(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(
        colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : null
      );
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const effectiveTheme = useMemo(() => {
    const currentSystemTheme = systemColorScheme || systemTheme;
    return getEffectiveTheme(
      userPreferences?.theme_preference || null,
      currentSystemTheme || null
    );
  }, [userPreferences?.theme_preference, systemColorScheme, systemTheme]);

  const themeColors = useMemo(
    () => getThemeColors(effectiveTheme),
    [effectiveTheme]
  );

  const setPreference = useCallback(async (preference: ThemePreference) => {
    try {
      await userPreferencesService.updateUserPreferences({
        theme_preference: preference,
      });
      const prefs = await userPreferencesService.getUserPreferences();
      setUserPreferences(prefs);
    } catch (error) {
      console.error('Failed to update theme preference:', error);
      throw error;
    }
  }, []);

  const value = useMemo<UseThemeReturn>(
    () => ({
      theme: effectiveTheme,
      colors: themeColors,
      isDark: effectiveTheme === 'dark',
      preference: userPreferences?.theme_preference || null,
      isLoading: loading,
      setPreference,
    }),
    [effectiveTheme, themeColors, userPreferences?.theme_preference, loading, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Consume shared theme from ThemeProvider.
 */
export function useThemeContext(): UseThemeReturn {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
