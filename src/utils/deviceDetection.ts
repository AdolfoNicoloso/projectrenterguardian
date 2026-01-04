import { Platform, Dimensions } from 'react-native';

/**
 * Device type detection utilities for React Native Web
 * Helps distinguish between mobile, tablet, and desktop browsers
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Get device type based on screen width
 * 
 * Breakpoints:
 * - Mobile: < 768px (typical phone width)
 * - Tablet: 768px - 1024px (iPad, Android tablets)
 * - Desktop: >= 1024px (laptops, desktops)
 * 
 * @param width - Screen width in pixels (from useWindowDimensions or Dimensions.get('window').width)
 * @returns Device type
 */
export function getDeviceType(width: number): DeviceType {
  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Check if device is mobile (phone) - width < 768px
 */
export function isMobileDevice(width: number): boolean {
  return width < 768;
}

/**
 * Check if device is tablet - width >= 768px and < 1024px
 */
export function isTabletDevice(width: number): boolean {
  return width >= 768 && width < 1024;
}

/**
 * Check if device is desktop - width >= 1024px
 */
export function isDesktopDevice(width: number): boolean {
  return width >= 1024;
}

/**
 * Get device type using Dimensions API (for non-hook contexts)
 * 
 * Usage:
 * ```tsx
 * const deviceType = getDeviceTypeFromDimensions();
 * if (deviceType === 'mobile') { ... }
 * ```
 */
export function getDeviceTypeFromDimensions(): DeviceType {
  if (Platform.OS !== 'web') {
    // On native iOS/Android, you can use Platform.OS to determine
    // For now, we'll assume mobile for native platforms
    return 'mobile';
  }
  
  const { width } = Dimensions.get('window');
  return getDeviceType(width);
}

/**
 * User Agent detection (alternative method)
 * Less reliable than screen width, but can detect device capabilities
 * 
 * Note: User agent can be spoofed, so use screen width as primary method
 */
export function detectDeviceFromUserAgent(): DeviceType | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return null;
  }

  const userAgent = navigator.userAgent.toLowerCase();

  // iPad detection (modern iPads report as macOS, so check for touch capability)
  const isIPad = /ipad/.test(userAgent) || 
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /macintosh/.test(userAgent));

  if (isIPad) {
    return 'tablet';
  }

  // Mobile detection
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'mobile';
  }

  // Default to desktop if nothing matches
  return 'desktop';
}

/**
 * Combined detection - uses screen width first, user agent as fallback
 */
export function detectDeviceType(width?: number): DeviceType {
  // Use provided width or get from Dimensions
  const screenWidth = width || (Platform.OS === 'web' ? Dimensions.get('window').width : 0);
  
  // Primary method: screen width (most reliable)
  if (screenWidth > 0) {
    return getDeviceType(screenWidth);
  }

  // Fallback: user agent (if width not available)
  return detectDeviceFromUserAgent() || 'desktop';
}

