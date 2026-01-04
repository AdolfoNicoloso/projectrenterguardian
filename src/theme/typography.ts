import { Platform, Text } from 'react-native';
import { FONT_CONFIG } from './fonts';

/**
 * Typography configuration using global font settings.
 * 
 * The font family is controlled by FONT_CONFIG in ./fonts.ts
 * To change the font globally, update that file.
 */
export const typography = {
  fontFamily: {
    // All font families use the global FONT_CONFIG
    regular: FONT_CONFIG.regular,
    medium: FONT_CONFIG.medium,
    bold: FONT_CONFIG.bold,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
