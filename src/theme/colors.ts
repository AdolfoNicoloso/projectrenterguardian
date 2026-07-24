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
  /** Text/icons on primary-filled controls */
  onPrimary: colors.light,

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
 *
 * Warm charcoal family anchored to brand dark `#191414`.
 * Surfaces step up clearly; text hierarchy stays readable without glare.
 */
export const darkColors = {
  // Canvas → grouped → pressed/hover
  background: '#191414',
  backgroundSecondary: '#221C1C',
  backgroundTertiary: '#2C2525',

  // Soft white primary; muted secondary/tertiary (not near-white)
  text: '#F4F2F2',
  textSecondary: '#A39C9C',
  textTertiary: '#7A7373',
  textInverse: '#191414',

  // Hairline separators that read on warm dark surfaces
  border: '#3A3333',
  borderSecondary: '#4A4242',

  // Brand purple lifted slightly for contrast on dark surfaces
  primary: '#9B6DFF',
  primaryLight: '#B794FF',
  primaryDark: '#7A3DFF',
  onPrimary: '#FFFFFF',

  // Semantic colors tuned for dark contrast
  error: '#FF6B63',
  success: '#3DDC6A',
  warning: '#FFB340',
  info: '#5AA9FF',

  overlay: 'rgba(0, 0, 0, 0.72)',
  shadow: '#000000',

  // Elevated surfaces (distinct from canvas)
  card: '#241E1E',
  cardSecondary: '#2C2525',

  inputBackground: '#2C2525',
  inputBorder: '#4A4242',
  inputPlaceholder: '#8A8282',
} as const;

export type ThemeColors = typeof lightColors;
