/**
 * Top-of-app banner for a new property invitation.
 * Accept stays in-app; does not navigate into the property.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/useTheme';
import { spacing, typography } from '../theme';
import { useNotificationsStore } from '../state/notificationsStore';
import { usePropertiesStore } from '../state/propertiesStore';
import { propertyMembersService } from '../services/propertyMembersService';
import { Routes } from '../navigation/routes';
import { useToast } from './PRGToastProvider';
import { useDesktopLayout } from '../hooks/useDesktopLayout';

export function InviteNotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const isDesktop = useDesktopLayout();
  const [accepting, setAccepting] = useState(false);

  const bannerInviteId = useNotificationsStore((s) => s.bannerInviteId);
  const items = useNotificationsStore((s) => s.items);
  const dismissBanner = useNotificationsStore((s) => s.dismissBanner);
  const markRead = useNotificationsStore((s) => s.markRead);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);

  const note = bannerInviteId
    ? items.find((n) => n.id === bannerInviteId)
    : null;

  if (!note || note.type !== 'property_invite' || note.read_at) {
    return null;
  }

  const accept = async () => {
    const token = (note.invite_token || '').trim();
    if (!token || accepting) return;
    setAccepting(true);
    try {
      await propertyMembersService.acceptInvite(token);
      try {
        await markRead(note.id);
      } catch {
        // Accept succeeded; inbox refresh will clear the badge.
      }
      await usePropertiesStore.getState().fetchList({ force: true });
      await fetchNotifications({ force: true });
      dismissBanner();
      showToast('Invitation accepted', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not accept invite';
      showToast(message, 'error');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: isDesktop ? spacing.md : Math.max(insets.top, spacing.sm),
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push(Routes.NOTIFICATIONS as never)}
          style={styles.textBlock}
          accessibilityRole="button"
          accessibilityLabel="Open invitation notification"
        >
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {note.title || 'Property invitation'}
          </Text>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {note.body || 'You’ve been invited to a property.'}
          </Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void accept()}
            disabled={accepting || !note.invite_token}
            style={({ pressed }) => [
              styles.acceptBtn,
              { backgroundColor: colors.primary },
              (pressed || accepting) && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Accept invitation"
          >
            <Text style={[styles.acceptText, { color: colors.onPrimary }]}>
              {accepting ? '…' : 'Accept'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => dismissBanner()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss invitation banner"
          >
            <Text style={[styles.dismiss, { color: colors.textSecondary }]}>
              ✕
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2000,
    elevation: 12,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as object,
      default: {},
    }),
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  body: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acceptBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
  },
  dismiss: {
    fontSize: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
