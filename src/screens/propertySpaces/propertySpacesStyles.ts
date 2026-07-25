import { StyleSheet, Platform } from 'react-native';
import { spacing, typography } from '../../theme';

export const propertySpacesStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  listWrap: { flex: 1 },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardGridItem: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 280,
    width: Platform.OS === 'web' ? ('calc(50% - 8px)' as unknown as number) : '48%',
  },
  cardStackItem: {
    width: '100%',
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    flex: 1,
    minHeight: 160,
  },
  unassignedCard: {
    marginTop: spacing.md,
  },
  cardPlaceholder: {
    opacity: 0.35,
    borderStyle: 'dashed',
  },
  spaceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  spaceRowDimmed: { opacity: 0.9 },
  floatingCard: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    padding: spacing.md,
    zIndex: 50,
    maxWidth: 320,
  },
  handleHit: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : {}),
  },
  handleGlyph: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  spacePress: { flex: 1 },
  spaceInfo: { flex: 1, paddingRight: spacing.sm },
  spaceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  spaceMeta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  photoRow: { marginTop: spacing.sm },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  emptyPhotos: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
