import { useColorScheme, Appearance } from 'react-native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { userPreferencesService } from '../services/userPreferencesService';
import { useAuthStore } from '../state/authStore';
import type { UserPreferences } from '../types';
import { lightColors, darkColors, type ThemeColors } from './colors';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'auto';

/**
 * Get the effective theme (light or dark) based on user preferences
 * and system theme.
 * 
 * Priority:
 * 1. User explicit preference ('light' or 'dark')
 * 2. System theme (when preference is 'auto' or null)
 * 3. Default to 'light' as fallback
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
  // 'auto' or null - use system theme
  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

/**
 * Get theme colors based on the effective theme.
 * Memoized for performance.
 */
function getThemeColors(theme: Theme): ThemeColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export interface UseThemeReturn {
  /** Current effective theme ('light' or 'dark') */
  theme: Theme;
  /** Theme-aware color palette */
  colors: ThemeColors;
  /** Boolean indicating if dark mode is active */
  isDark: boolean;
  /** Current user preference ('light', 'dark', 'auto', or null) */
  preference: ThemePreference | null;
  /** Whether theme data is still loading */
  isLoading: boolean;
  /** Update theme preference */
  setPreference: (preference: ThemePreference) => Promise<void>;
}

/**
 * Hook to get theme-aware colors and the effective theme.
 * Automatically updates when system theme or user preferences change.
 * 
 * Features:
 * - Memoized color calculations for performance
 * - System theme detection and listening
 * - User preference persistence
 * - Optimized re-renders
 * 
 * @example
 * ```tsx
 * const { colors, theme, isDark, setPreference } = useTheme();
 * 
 * return (
 *   <View style={{ backgroundColor: colors.background }}>
 *     <Text style={{ color: colors.text }}>Hello</Text>
 *   </View>
 * );
 * ```
 */
export function useTheme(): UseThemeReturn {
  const systemColorScheme = useColorScheme();
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark' | null>(
    Appearance.getColorScheme()
  );

  // Get auth state
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Load user preferences (only when authenticated)
  useEffect(() => {
    // Don't load preferences if auth is still loading or user is not authenticated
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
        // Gracefully handle errors (e.g., permissions, collection doesn't exist)
        // Return null preferences to use system theme as fallback
        // Only log if it's not an auth error (to avoid spamming console)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Authentication required')) {
          console.warn('Error loading user preferences, using system theme:', error);
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

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Calculate effective theme (memoized)
  const effectiveTheme = useMemo(() => {
    const currentSystemTheme = systemColorScheme || systemTheme;
    return getEffectiveTheme(
      userPreferences?.theme_preference || null,
      currentSystemTheme || null
    );
  }, [userPreferences?.theme_preference, systemColorScheme, systemTheme]);

  // Get theme colors (memoized to prevent recalculation)
  const themeColors = useMemo(() => getThemeColors(effectiveTheme), [effectiveTheme]);

  // Update preference function (memoized to prevent recreation)
  const setPreference = useCallback(async (preference: ThemePreference) => {
    try {
      await userPreferencesService.updateUserPreferences({ theme_preference: preference });
      // Reload preferences to get updated value
      const prefs = await userPreferencesService.getUserPreferences();
      setUserPreferences(prefs);
    } catch (error) {
      console.error('Failed to update theme preference:', error);
      throw error;
    }
  }, []);

  return {
    theme: effectiveTheme,
    colors: themeColors,
    isDark: effectiveTheme === 'dark',
    preference: userPreferences?.theme_preference || null,
    isLoading: loading,
    setPreference,
  };
}

