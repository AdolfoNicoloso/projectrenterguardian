/**
 * Header / side-nav bell with red unread badge.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/useTheme';
import { typography } from '../theme';
import { useNotificationsStore } from '../state/notificationsStore';
import { Routes } from '../navigation/routes';
import { BellIcon, NAV_ICON_SIZE } from './NavTabIcons';

type GlyphProps = {
  size?: number;
};

/** Icon + badge only (for PRGHeader rightActions). */
export function NotificationsBellGlyph({
  size = NAV_ICON_SIZE.action,
}: GlyphProps) {
  const { colors } = useTheme();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
      <BellIcon size={size} color={colors.text} />
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

type NotificationsBellButtonProps = {
  size?: number;
  compact?: boolean;
};

/** Standalone pressable bell (desktop side nav, etc.). */
export function NotificationsBellButton({
  size = NAV_ICON_SIZE.action,
  compact = false,
}: NotificationsBellButtonProps) {
  const router = useRouter();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  return (
    <Pressable
      onPress={() => router.push(Routes.NOTIFICATIONS as never)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
    >
      <NotificationsBellGlyph size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  buttonCompact: {
    width: 36,
    height: 36,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 12,
  },
});
