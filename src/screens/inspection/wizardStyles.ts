import { StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  progressContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  stepTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  stepNote: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  addSpaceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
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
  propertyButton: {
    marginBottom: spacing.sm,
  },
  spaceItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  spaceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  spaceNote: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  reviewItem: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
  },
  notesInput: {
    marginTop: spacing.md,
  },
  notesHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
  photoCountContainer: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  photoCountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  uploadList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  uploadItem: {
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  uploadFilename: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  uploadStatus: {
    fontSize: typography.fontSize.xs,
  },
  successText: {
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
  },
  spacePhotoItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  spacePhotoCount: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  spaceUploadButton: {
    marginBottom: spacing.sm,
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  spaceReviewList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
  },
  spaceReviewItem: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
});
