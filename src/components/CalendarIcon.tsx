import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { NAV_ICON_SIZE } from './NavTabIcons';

type CalendarIconProps = {
  size?: number;
  color: string;
};

/** Simple calendar glyph for header / section actions (matches nav stroke style). */
export function CalendarIcon({ size = NAV_ICON_SIZE.action, color }: CalendarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      <Path d="M3.5 10h17" stroke={color} strokeWidth="2" />
      <Path
        d="M8 3.5v4M16 3.5v4"
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
