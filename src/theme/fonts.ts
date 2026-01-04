import { Platform } from 'react-native';

/**
 * Global Font Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all fonts in the application.
 * To change the font globally, update the values in this file.
 * 
 * Current Font: Open Sans
 */
export const FONT_CONFIG = {
  // Primary font family name
  name: 'Open Sans',
  
  // Platform-specific font family strings
  // Web: Uses Google Fonts (loaded via _layout.tsx)
  // Mobile: Uses system sans-serif fonts until Open Sans fonts are bundled
  // To bundle fonts for mobile: 
  //   1. Install: npm install expo-font
  //   2. Download Open Sans font files (.ttf or .otf)
  //   3. Add fonts to assets/fonts/ directory
  //   4. Load fonts in app/_layout.tsx using useFonts hook
  //   5. Then change mobile values below to 'OpenSans-Regular', etc.
  regular: Platform.select({
    ios: 'System', // Change to 'OpenSans-Regular' after bundling fonts
    android: 'sans-serif', // Change to 'OpenSans-Regular' after bundling fonts
    web: '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'sans-serif',
  }) || 'sans-serif',
  
  medium: Platform.select({
    ios: 'System', // Change to 'OpenSans-SemiBold' after bundling fonts
    android: 'sans-serif-medium', // Change to 'OpenSans-SemiBold' after bundling fonts
    web: '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'sans-serif-medium',
  }) || 'sans-serif-medium',
  
  bold: Platform.select({
    ios: 'System', // Change to 'OpenSans-Bold' after bundling fonts
    android: 'sans-serif', // Change to 'OpenSans-Bold' after bundling fonts (use fontWeight: 'bold')
    web: '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'sans-serif',
  }) || 'sans-serif',
  
  // Google Fonts URL for web (automatically loaded in _layout.tsx)
  webFontUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
  
  // Font file names for React Native (for when using expo-font with bundled fonts)
  fontFiles: {
    regular: 'OpenSans-Regular',
    semibold: 'OpenSans-SemiBold',
    bold: 'OpenSans-Bold',
  },
} as const;

/**
 * HOW TO CHANGE THE FONT GLOBALLY:
 * 
 * 1. Update the 'name' property above
 * 2. Update the platform-specific font family strings for regular, medium, and bold
 * 3. Update the webFontUrl if using Google Fonts (or remove if using system fonts)
 * 4. Update fontFiles if you plan to bundle font files for mobile
 * 
 * That's it! The font will automatically apply everywhere in the app.
 */

