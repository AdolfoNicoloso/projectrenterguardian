import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

type CalendarIconProps = {
  size?: number;
  color: string;
};

/** Simple calendar glyph for header / section actions. */
export function CalendarIcon({ size = 22, color }: CalendarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      <Path d="M3 10h18" stroke={color} strokeWidth="2" />
      <Path
        d="M8 3v4M16 3v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
