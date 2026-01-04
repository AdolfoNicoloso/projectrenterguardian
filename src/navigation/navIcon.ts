import React from 'react';
// Import SVG files as React components
import HouseBlack from '../../assets/nav_bar_symbols_final/house.black.svg';
import HouseWhite from '../../assets/nav_bar_symbols_final/house.white.svg';
import HouseFill from '../../assets/nav_bar_symbols_final/house.fill.svg';
import ChecklistBlack from '../../assets/nav_bar_symbols_final/checklist.black.svg';
import ChecklistWhite from '../../assets/nav_bar_symbols_final/checklist.white.svg';
import ChecklistFill from '../../assets/nav_bar_symbols_final/checklist.fill.svg';
import LightbulbBlack from '../../assets/nav_bar_symbols_final/lightbulb.black.svg';
import LightbulbWhite from '../../assets/nav_bar_symbols_final/lightbulb.white.svg';
import LightbulbFill from '../../assets/nav_bar_symbols_final/lightblub.fill.svg';
import PersonBlack from '../../assets/nav_bar_symbols_final/person.black.svg';
import PersonWhite from '../../assets/nav_bar_symbols_final/person.white.svg';
import PersonFill from '../../assets/nav_bar_symbols_final/person.fill.svg';

// Icon assets as React components
const iconAssets = {
  house: {
    black: HouseBlack,
    white: HouseWhite,
    fill: HouseFill,
  },
  checklist: {
    black: ChecklistBlack,
    white: ChecklistWhite,
    fill: ChecklistFill,
  },
  lightbulb: {
    black: LightbulbBlack,
    white: LightbulbWhite,
    fill: LightbulbFill,
  },
  person: {
    black: PersonBlack,
    white: PersonWhite,
    fill: PersonFill,
  },
};

/**
 * Icon name mapping for routes
 */
const iconMap: Record<string, keyof typeof iconAssets> = {
  properties: 'house',
  inspections: 'checklist',
  insights: 'lightbulb',
  profile: 'person',
};

/**
 * Get the icon component for a navigation tab.
 * @param routeName - The route name (properties, inspections, insights, profile)
 * @param focused - Whether the tab is currently active
 * @param theme - The effective theme ('light' | 'dark')
 * @returns The React component for the appropriate SVG icon
 */
export function getNavIcon(
  routeName: string,
  focused: boolean,
  theme: 'light' | 'dark'
): React.ComponentType<any> {
  const iconName = iconMap[routeName] || 'house';
  const iconSet = iconAssets[iconName];

  // If focused, always use fill variant
  if (focused) {
    return iconSet.fill;
  }

  // If not focused, use theme-based variant
  return theme === 'dark' ? iconSet.white : iconSet.black;
}

