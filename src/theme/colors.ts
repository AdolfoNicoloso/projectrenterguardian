/**
 * Base color palette - platform and theme agnostic
 */
export const colors = {
  primary: '#6F00FF',
  dark: '#191414',
  light: '#FFFFFF',
  gray: {
    50: '#F9F9F9',
    100: '#F0F0F0',
    200: '#E0E0E0',
    300: '#C0C0C0',
    400: '#808080',
    500: '#606060',
    600: '#404040',
    700: '#303030',
    800: '#202020',
    900: '#101010',
  },
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  info: '#007AFF',
} as const;

export type ColorKey = keyof typeof colors;

/**
 * Light theme color palette
 */
export const lightColors = {
  // Background colors
  background: colors.light,
  backgroundSecondary: colors.gray[50],
  backgroundTertiary: colors.gray[100],
  
  // Text colors
  text: colors.dark,
  textSecondary: colors.gray[600],
  textTertiary: colors.gray[500],
  textInverse: colors.light,
  
  // Border colors
  border: colors.gray[200],
  borderSecondary: colors.gray[300],
  
  // Interactive colors
  primary: colors.primary,
  primaryLight: '#9D4EDD',
  primaryDark: '#5A00CC',
  
  // Semantic colors
  error: colors.error,
  success: colors.success,
  warning: colors.warning,
  info: colors.info,
  
  // Overlay and shadow
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: colors.dark,
  
  // Card and surface
  card: colors.light,
  cardSecondary: colors.gray[50],
  
  // Input colors
  inputBackground: colors.light,
  inputBorder: colors.gray[300],
  inputPlaceholder: colors.gray[400],
} as const;

/**
 * Dark theme color palette
 * Following iOS and Material Design dark mode guidelines
 * Brand dark background: #191414
 */
export const darkColors = {
  // Background colors - using brand color #191414
  background: '#191414',
  backgroundSecondary: '#1F1A1A', // Slightly lifted for cards/surfaces
  backgroundTertiary: '#241F1F',
  
  // Text colors - high contrast for readability
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#EBEBF599', // 60% opacity
  textInverse: colors.dark,
  
  // Border colors - subtle but visible
  border: '#38383A',
  borderSecondary: '#48484A',
  
  // Interactive colors - slightly brighter primary in dark mode
  primary: '#8B5FFF',
  primaryLight: '#A57FFF',
  primaryDark: '#6F00FF',
  
  // Semantic colors - adjusted for dark mode contrast
  error: '#FF453A',
  success: '#32D74B',
  warning: '#FF9F0A',
  info: '#0A84FF',
  
  // Overlay and shadow
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: '#000000',
  
  // Card and surface - elevated surfaces
  card: '#1C1C1E',
  cardSecondary: '#2C2C2E',
  
  // Input colors
  inputBackground: '#2C2C2E',
  inputBorder: '#48484A',
  inputPlaceholder: '#8E8E93',
} as const;

export type ThemeColors = typeof lightColors;


