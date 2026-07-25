import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import { spacing, typography } from '../../theme';
import { useTheme } from '../../theme/useTheme';
import type { AddPropertyCardProps } from './types';

/** Desktop grid tile: dashed empty slot that starts property creation. */
export function AddPropertyCard({ onPress }: AddPropertyCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.addCard,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.backgroundTertiary : colors.backgroundSecondary,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add property"
      accessibilityHint="Creates a new property"
    >
      <Text style={[styles.addCardPlus, { color: colors.primary }]}>+</Text>
      <Text style={[styles.addCardTitle, { color: colors.text }]}>Add property</Text>
      <Text style={[styles.addCardHint, { color: colors.textSecondary }]}>
        Tour a place or add a rental
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addCard: {
    flex: 1,
    minHeight: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  addCardPlus: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 40,
    marginBottom: spacing.xs,
  },
  addCardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  addCardHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
});
