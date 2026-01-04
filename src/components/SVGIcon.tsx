import React from 'react';
import { ViewStyle } from 'react-native';

interface SVGIconProps {
  source: React.ComponentType<{ width?: number; height?: number; style?: ViewStyle }>;
  size: number;
  style?: ViewStyle;
}

/**
 * SVGIcon - Renders an SVG icon component with proper sizing
 * Works on both native (iOS/Android) and web
 * When using react-native-svg-transformer, SVG files are imported as React components
 */
export const SVGIcon: React.FC<SVGIconProps> = ({ source: SvgComponent, size, style }) => {
  return <SvgComponent width={size} height={size} style={style} />;
};

