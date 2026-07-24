/**
 * Tab / side-nav icons — stroke glyphs that take theme palette colors.
 * Rents = house, Tours = calendar (kept metaphors). Inspections / Reports / Profile are new.
 */

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ThemeColors } from '../theme/colors';

export const NAV_ICON_SIZE = {
  /** Bottom tab bar (mobile web + native) */
  tab: 26,
  /** Desktop left rail */
  sideNav: 22,
  /** Header / inline actions */
  action: 22,
} as const;

export type NavTabKey = 'rents' | 'tours' | 'inspections' | 'insights' | 'profile';

type IconProps = {
  size?: number;
  color: string;
  /** Slightly heavier stroke when the tab is selected. */
  focused?: boolean;
};

function strokeWidth(focused?: boolean): number {
  return focused ? 2.25 : 2;
}

/** Rents — house (kept metaphor). */
export function HouseIcon({ size = NAV_ICON_SIZE.tab, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5L12 4l8 6.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 20v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Tours — calendar (kept metaphor). */
export function CalendarNavIcon({ size = NAV_ICON_SIZE.tab, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2"
        stroke={color}
        strokeWidth={sw}
      />
      <Path d="M3.5 10h17" stroke={color} strokeWidth={sw} />
      <Path
        d="M8 3.5v4M16 3.5v4"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path
        d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"
        stroke={color}
        strokeWidth={focused ? 2.75 : 2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Inspections — clipboard with check. */
export function ClipboardCheckIcon({ size = NAV_ICON_SIZE.tab, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 4.5h6a1.5 1.5 0 0 1 1.5 1.5v1H7.5V6A1.5 1.5 0 0 1 9 4.5Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <Rect
        x="5.5"
        y="6.5"
        width="13"
        height="14"
        rx="2"
        stroke={color}
        strokeWidth={sw}
      />
      <Path
        d="M9 13.5l2 2 4-4.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Reports — document. */
export function DocumentIcon({ size = NAV_ICON_SIZE.tab, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.5h7l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <Path
        d="M14 3.5V8h4.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12.5h6M9 16h4"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Profile — person. */
export function PersonIcon({ size = NAV_ICON_SIZE.tab, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.25" stroke={color} strokeWidth={sw} />
      <Path
        d="M5.5 19.5c1.6-3.2 3.9-4.75 6.5-4.75s4.9 1.55 6.5 4.75"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Notifications — classic bell. */
export function BellIcon({ size = NAV_ICON_SIZE.action, color, focused }: IconProps) {
  const sw = strokeWidth(focused);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.5 1.5 5 1.5 5H5s1.5-1.5 1.5-5Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Active = brand primary; idle = secondary text — matches palette. */
export function navIconColor(
  focused: boolean,
  colors: Pick<ThemeColors, 'primary' | 'textSecondary'>
): string {
  return focused ? colors.primary : colors.textSecondary;
}

const ICONS: Record<NavTabKey, React.FC<IconProps>> = {
  rents: HouseIcon,
  tours: CalendarNavIcon,
  inspections: ClipboardCheckIcon,
  insights: DocumentIcon,
  profile: PersonIcon,
};

type NavTabIconProps = {
  name: NavTabKey;
  focused: boolean;
  colors: Pick<ThemeColors, 'primary' | 'textSecondary'>;
  size?: number;
};

/** Single entry point for tab / side-nav glyphs. */
export function NavTabIcon({
  name,
  focused,
  colors,
  size = NAV_ICON_SIZE.tab,
}: NavTabIconProps) {
  const Icon = ICONS[name];
  return <Icon size={size} color={navIconColor(focused, colors)} focused={focused} />;
}
