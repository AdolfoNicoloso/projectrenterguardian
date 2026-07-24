/**
 * Desktop web layout gate: true only on web at/above the laptop breakpoint.
 * Native and narrow mobile web keep the existing phone shell.
 */

import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '../theme/layout';

export function useDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= layout.desktopBreakpoint;
}
