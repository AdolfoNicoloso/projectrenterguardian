import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PRGBadge, PRGButton } from '../../components';
import {
  formatPropertyAddress,
  propertyDisplayName,
} from '../../constants/propertyStatuses';
import { spacing, typography } from '../../theme';
import { useTheme } from '../../theme/useTheme';
import type { PropertyHubCardProps } from './types';

export function PropertyHubCard({
  property,
  statusLabel,
  stageLabel,
  stageVariant,
  stageDetail,
  primaryAction,
  secondaryAction,
  onOpen,
  compact = false,
}: PropertyHubCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.hubCard,
        compact && styles.hubCardCompact,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open property">
        <View style={styles.statusRow}>
          {stageLabel ? (
            <View style={styles.scheduleBadgeRow}>
              <PRGBadge
                label={stageLabel}
                variant={stageVariant ?? 'default'}
              />
              {stageDetail ? (
                <Text
                  style={[styles.tourScheduledAt, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {stageDetail}
                </Text>
              ) : null}
            </View>
          ) : statusLabel ? (
            <Text style={[styles.statusPill, { color: colors.primary }]}>{statusLabel}</Text>
          ) : null}
        </View>
        <Text style={[styles.hubTitle, compact && styles.hubTitleCompact, { color: colors.text }]}>
          {propertyDisplayName(property)}
        </Text>
        <Text style={[styles.hubAddress, { color: colors.textSecondary }]} numberOfLines={2}>
          {formatPropertyAddress(property)}
        </Text>
      </Pressable>
      {primaryAction ? (
        <PRGButton
          title={primaryAction.label}
          onPress={primaryAction.onPress}
          variant="primary"
          style={styles.hubPrimaryButton}
        />
      ) : null}
      {secondaryAction ? (
        <PRGButton
          title={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="secondary"
          disabled={secondaryAction.disabled}
          style={styles.hubSecondaryButton}
          accessibilityLabel={secondaryAction.label}
        />
      ) : null}
      <PRGButton title="Open property" onPress={onOpen} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  hubCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  hubCardCompact: {
    marginBottom: 0,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  scheduleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flexShrink: 1,
  },
  tourScheduledAt: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    flexShrink: 1,
  },
  statusPill: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hubTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  hubTitleCompact: {
    fontSize: typography.fontSize.xl,
  },
  hubAddress: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  hubPrimaryButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  hubSecondaryButton: {
    marginBottom: spacing.xs,
  },
});
