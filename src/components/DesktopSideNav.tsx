/**
 * Persistent left navigation for desktop web only.
 * Replaces the bottom tab bar with labeled destinations + brand mark.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '../theme/useTheme';
import { layout } from '../theme/layout';
import { spacing, typography } from '../theme';
import { NavTabIcon, NAV_ICON_SIZE, type NavTabKey } from './NavTabIcons';

type NavItem = {
  key: NavTabKey;
  label: string;
  href: string;
  /** Path prefixes that mark this item active. */
  matchPrefixes: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    key: 'rents',
    label: 'Rents',
    href: '/(tabs)/rents',
    matchPrefixes: ['/(tabs)/rents', '/rents'],
  },
  {
    key: 'tours',
    label: 'Tours',
    href: '/(tabs)/tours',
    matchPrefixes: ['/(tabs)/tours', '/tours'],
  },
  {
    key: 'inspections',
    label: 'Inspections',
    href: '/(tabs)/inspections',
    matchPrefixes: ['/(tabs)/inspections', '/inspections'],
  },
  {
    key: 'insights',
    label: 'Reports',
    href: '/(tabs)/insights',
    matchPrefixes: ['/(tabs)/insights', '/insights'],
  },
  {
    key: 'profile',
    label: 'Profile',
    href: '/(tabs)/profile',
    matchPrefixes: ['/(tabs)/profile', '/profile'],
  },
];

function isActivePath(pathname: string, item: NavItem): boolean {
  return item.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function DesktopSideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colors.backgroundSecondary,
          borderRightColor: colors.border,
        },
      ]}
      accessibilityRole="menu"
      accessibilityLabel="Main navigation"
    >
      <View style={styles.brand}>
        <Image
          source={require('../../assets/favicon.png')}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="Renter Guardian logo"
        />
        <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>
          Renter Guardian
        </Text>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const focused = isActivePath(pathname, item);
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.key === 'inspections') {
                  router.navigate('/(tabs)/inspections');
                  return;
                }
                router.navigate(item.href as never);
              }}
              style={({ pressed }) => [
                styles.navItem,
                focused && {
                  backgroundColor: colors.primary + '18',
                  borderColor: colors.primary + '40',
                },
                pressed &&
                  !focused && {
                    backgroundColor: colors.backgroundTertiary,
                  },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
            >
              <NavTabIcon
                name={item.key}
                focused={focused}
                colors={colors}
                size={NAV_ICON_SIZE.sideNav}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: focused ? colors.primary : colors.textSecondary,
                    fontWeight: focused
                      ? typography.fontWeight.semibold
                      : typography.fontWeight.medium,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: layout.sideNavWidth,
    borderRightWidth: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandName: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
  navList: {
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  navLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
  },
});
