/**
 * Notifications inbox — invitations and other alerts.
 * Accepting an invite does not deep-link into the property.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  PRGButton,
  PRGEmptyState,
  PRGHeader,
  ScreenContainer,
  useToast,
  useWebPageContentStyle,
} from '../../src/components';
import { useNotificationsStore } from '../../src/state/notificationsStore';
import { usePropertiesStore } from '../../src/state/propertiesStore';
import { propertyMembersService } from '../../src/services/propertyMembersService';
import type { AppNotification } from '../../src/types';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { Routes } from '../../src/navigation/routes';
import { goBackOr } from '../../src/navigation/goBackOr';

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const contentStyle = useWebPageContentStyle();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const fetch = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  useFocusEffect(
    useCallback(() => {
      void fetch({ force: true });
    }, [fetch])
  );

  const acceptInvite = async (note: AppNotification) => {
    const token = (note.invite_token || '').trim();
    if (!token || acceptingId) return;
    setAcceptingId(note.id);
    try {
      await propertyMembersService.acceptInvite(token);
      try {
        await markRead(note.id);
      } catch {
        // Accept won; refresh will sync.
      }
      await usePropertiesStore.getState().fetchList({ force: true });
      await fetch({ force: true });
      showToast('Invitation accepted — property is in your list', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not accept invite';
      showToast(message, 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader
        title="Notifications"
        showBack
        onBack={() => {
          goBackOr(router, Routes.RENTS.LIST);
        }}
        rightAction={
          unreadCount > 0
            ? {
                label: 'Mark all read',
                onPress: () => {
                  void markAllRead()
                    .then(() => showToast('All caught up', 'success'))
                    .catch((err: unknown) => {
                      const message =
                        err instanceof Error ? err.message : 'Could not update';
                      showToast(message, 'error');
                    });
                },
              }
            : undefined
        }
      />
      {items.length === 0 && !loading ? (
        <PRGEmptyState
          title="No notifications yet"
          message="When someone invites you to a property, it will show up here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            contentStyle,
            styles.list,
            { paddingBottom: spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void fetch({ force: true })}
              tintColor={colors.primary}
            />
          }
        >
          {items.map((note) => {
            const unread = !note.read_at;
            const isInvite = note.type === 'property_invite';
            return (
              <Pressable
                key={note.id}
                onPress={() => {
                  if (unread) void markRead(note.id).catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: unread
                      ? colors.backgroundSecondary
                      : colors.card,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={note.title}
              >
                <View style={styles.rowHeader}>
                  {unread ? (
                    <View
                      style={[styles.dot, { backgroundColor: colors.error }]}
                    />
                  ) : (
                    <View style={styles.dotSpacer} />
                  )}
                  <Text
                    style={[styles.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {note.title || 'Notification'}
                  </Text>
                  <Text
                    style={[styles.when, { color: colors.textTertiary }]}
                    numberOfLines={1}
                  >
                    {formatWhen(note.date_created)}
                  </Text>
                </View>
                <Text
                  style={[styles.rowBody, { color: colors.textSecondary }]}
                  numberOfLines={3}
                >
                  {note.body}
                </Text>
                {isInvite && note.invite_token && unread ? (
                  <View style={styles.inviteActions}>
                    <PRGButton
                      title="Accept invitation"
                      onPress={() => void acceptInvite(note)}
                      loading={acceptingId === note.id}
                      disabled={!!acceptingId}
                      style={styles.acceptBtn}
                    />
                    <PRGButton
                      title="Dismiss"
                      variant="ghost"
                      onPress={() => void markRead(note.id)}
                      disabled={!!acceptingId}
                      style={styles.acceptBtn}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotSpacer: {
    width: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
  },
  when: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  rowBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginLeft: 12,
  },
  inviteActions: {
    marginTop: spacing.sm,
    marginLeft: 12,
    gap: spacing.xs,
  },
  acceptBtn: {
    alignSelf: 'flex-start',
  },
});
