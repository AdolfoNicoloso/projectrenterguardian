import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  PRGHeader,
  PRGButton,
  PRGCard,
  PRGEmptyState,
  PRGBadge,
  PRGConfirmDialog,
  ScreenContainer,
  useToast,
} from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Inspection, Property } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/cmsDateTime';
import { getInspectionTypeLabel } from '../../../src/constants/inspectionTypes';

type DeleteStage = null | 'confirm' | 'confirmAgain';

function propertyLabel(property?: Property | null): string {
  if (!property) return 'Unknown property';
  const nickname = property.nickname?.trim();
  if (nickname) return nickname;
  const address = property.address_free_text?.trim();
  return address || 'Unknown property';
}

export default function InspectionsHomeScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const propertiesById = usePropertiesStore((s) => s.byId);
  const fetchList = usePropertiesStore((s) => s.fetchList);
  const [drafts, setDrafts] = useState<Inspection[]>([]);
  const [completed, setCompleted] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Inspection | null>(null);
  const [deleteStage, setDeleteStage] = useState<DeleteStage>(null);
  const [deleting, setDeleting] = useState(false);

  const loadInspections = useCallback(async () => {
    try {
      const [draftData, completedData] = await Promise.all([
        inspectionsService.getMyInspections({ status: 'in_progress' }),
        inspectionsService.getMyInspections({ status: 'completed' }),
        fetchList({ force: false }),
      ]);
      setDrafts(draftData);
      setCompleted(completedData);
    } catch (error) {
      console.error('Error loading inspections:', error);
      showToast('Failed to load inspections', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, fetchList]);

  useFocusEffect(
    useCallback(() => {
      void loadInspections();
    }, [loadInspections])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInspections();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  const openDraft = (inspection: Inspection) => {
    router.push(`/(tabs)/inspections/${inspection.id}`);
  };

  const startDelete = (inspection: Inspection) => {
    setDeleteTarget(inspection);
    setDeleteStage('confirm');
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteStage(null);
  };

  const advanceOrConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    if (deleteStage === 'confirm') {
      setDeleteStage('confirmAgain');
      return;
    }
    if (deleteStage !== 'confirmAgain') return;

    setDeleting(true);
    try {
      await inspectionsService.deleteInspection(deleteTarget.id);
      showToast('Draft inspection deleted', 'success');
      setDeleteTarget(null);
      setDeleteStage(null);
      await loadInspections();
    } catch (error) {
      console.error('Error deleting inspection:', error);
      showToast('Failed to delete inspection', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewResults = (inspection: Inspection) => {
    router.push(`/(tabs)/insights?inspectionId=${inspection.id}`);
  };

  const sections = [
    ...(drafts.length > 0 ? [{ title: 'Drafts', data: drafts, kind: 'draft' as const }] : []),
    ...(completed.length > 0
      ? [{ title: 'Completed', data: completed, kind: 'completed' as const }]
      : []),
  ];

  if (loading && drafts.length === 0 && completed.length === 0) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader title="Inspections" showBack={false} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader
        title="Inspections"
        showBack={false}
        rightAction={{
          label: 'New',
          onPress: () => router.push('/(tabs)/inspections/new'),
        }}
      />
      {drafts.length === 0 && completed.length === 0 ? (
        <PRGEmptyState
          title="No inspections yet"
          message="Start a move-in inspection, document a property tour, or capture condition anytime."
          actionLabel="New Inspection"
          onAction={() => router.push('/(tabs)/inspections/new')}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, index) => `${item.title}-${index}`}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {section.title}
              </Text>
              {section.data.map((inspection) => (
                <PRGCard key={inspection.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {getInspectionTypeLabel(inspection.inspection_type)}
                      </Text>
                      <Text style={[styles.cardProperty, { color: colors.textSecondary }]}>
                        {propertyLabel(propertiesById[inspection.property_id])}
                      </Text>
                      {section.kind === 'draft' ? (
                        <PRGBadge label="Draft" variant="warning" style={styles.badge} />
                      ) : (
                        <PRGBadge label="Completed" variant="success" style={styles.badge} />
                      )}
                    </View>
                    <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                      {formatDate(inspection.started_at)}
                    </Text>
                  </View>

                  {section.kind === 'draft' && (
                    <>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${inspection.inspections_progress}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                          {inspection.inspections_progress}%
                        </Text>
                      </View>
                      <PRGButton
                        title="Open draft"
                        onPress={() => openDraft(inspection)}
                        variant="primary"
                        style={styles.resumeButton}
                        accessibilityLabel="Open draft inspection"
                        accessibilityHint="Continues the inspection where you left off"
                      />
                      <PRGButton
                        title="Delete draft"
                        onPress={() => startDelete(inspection)}
                        variant="ghost"
                        textColor={colors.error}
                        style={styles.deleteButton}
                        accessibilityLabel="Delete draft inspection"
                      />
                    </>
                  )}

                  {section.kind === 'completed' && (
                    <PRGButton
                      title="View Results"
                      onPress={() => handleViewResults(inspection)}
                      variant="secondary"
                      style={styles.viewButton}
                    />
                  )}
                </PRGCard>
              ))}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}

      <PRGConfirmDialog
        visible={deleteStage === 'confirm'}
        title="Delete this draft?"
        message="This unfinished inspection will be removed. Photos already uploaded to the property will stay."
        cancelLabel="Keep draft"
        confirmLabel="Delete"
        destructive
        onCancel={cancelDelete}
        onConfirm={advanceOrConfirmDelete}
      />

      <PRGConfirmDialog
        visible={deleteStage === 'confirmAgain'}
        title="Are you sure?"
        message="This cannot be undone. Delete this draft inspection permanently?"
        cancelLabel="Cancel"
        confirmLabel={deleting ? 'Deleting…' : 'Delete permanently'}
        destructive
        onCancel={cancelDelete}
        onConfirm={advanceOrConfirmDelete}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  cardProperty: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  badge: {
    alignSelf: 'flex-start',
  },
  cardDate: {
    fontSize: typography.fontSize.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    minWidth: 40,
    textAlign: 'right',
  },
  resumeButton: {
    marginTop: spacing.xs,
  },
  deleteButton: {
    marginTop: spacing.xs,
  },
  viewButton: {
    marginTop: spacing.xs,
  },
});
