import { StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  stepTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  stepNote: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  progressNote: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  listBlock: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  addSpaceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addSpaceTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  spaceTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spaceTypeChip: {
    marginBottom: 0,
  },
  addSpaceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addSpaceActionButton: {
    minWidth: 100,
  },
  inlineError: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
