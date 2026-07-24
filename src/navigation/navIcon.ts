/**
 * Legacy asset-based tab icons (hardcoded black/white/fill SVGs).
 * Prefer NavTabIcon from src/components/NavTabIcons for new UI —
 * colorable stroke glyphs matched to the theme palette.
 *
 * Kept for any remaining callers that still import getNavIcon.
 */

import React from 'react';
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

const iconMap: Record<string, keyof typeof iconAssets> = {
  rents: 'house',
  properties: 'house',
  inspections: 'checklist',
  insights: 'lightbulb',
  profile: 'person',
};

/** @deprecated Use NavTabIcon from components/NavTabIcons */
export function getNavIcon(
  routeName: string,
  focused: boolean,
  theme: 'light' | 'dark'
): React.ComponentType<any> {
  const iconName = iconMap[routeName] || 'house';
  const iconSet = iconAssets[iconName];
  if (focused) return iconSet.fill;
  return theme === 'dark' ? iconSet.white : iconSet.black;
}
