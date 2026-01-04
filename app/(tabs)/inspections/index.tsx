import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGHeader, PRGButton, PRGCard, PRGEmptyState, ScreenContainer, useToast } from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Inspection } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/directusDate';

export default function InspectionsHomeScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [inProgress, setInProgress] = useState<Inspection[]>([]);
  const [completed, setCompleted] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInspections = useCallback(async () => {
    try {
      const [inProgressData, completedData] = await Promise.all([
        inspectionsService.getMyInspections({ status: 'in_progress' }),
        inspectionsService.getMyInspections({ status: 'completed' }),
      ]);
      setInProgress(inProgressData);
      setCompleted(completedData);
    } catch (error) {
      console.error('Error loading inspections:', error);
      showToast('Failed to load inspections', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInspections();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  const handleResume = (inspection: Inspection) => {
    // Navigate to the inspection wizard at the last step
    router.push(`/(tabs)/inspections/${inspection.id}`);
  };

  const handleViewResults = (inspection: Inspection) => {
    // Navigate to insights/report for this inspection
    router.push(`/(tabs)/insights?inspectionId=${inspection.id}`);
  };

  const sections = [
    ...(inProgress.length > 0 ? [{ title: 'In Progress', data: inProgress }] : []),
    ...(completed.length > 0 ? [{ title: 'Completed', data: completed }] : []),
  ];

  if (loading && inProgress.length === 0 && completed.length === 0) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader title="Inspections" showBack={false} />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
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
      {inProgress.length === 0 && completed.length === 0 ? (
        <PRGEmptyState
          title="No inspections yet"
          message="Start a new inspection to document your property"
          actionLabel="New Inspection"
          onAction={() => router.push('/(tabs)/inspections/new')}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, index) => `${item.title}-${index}`}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
              {section.data.map((inspection) => (
                <PRGCard key={inspection.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {inspection.inspection_type || 'Inspection'}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                      {formatDate(inspection.started_at)}
                    </Text>
                  </View>
                  {inspection.inspection_status === 'in_progress' && (
                    <>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${inspection.inspections_progress}%`, backgroundColor: colors.primary },
                            ]}
                          />
                        </View>
                        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                          {inspection.inspections_progress}%
                        </Text>
                      </View>
                      <PRGButton
                        title="Resume"
                        onPress={() => handleResume(inspection)}
                        variant="primary"
                        style={styles.resumeButton}
                      />
                    </>
                  )}
                  {inspection.inspection_status === 'completed' && (
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
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
  viewButton: {
    marginTop: spacing.xs,
  },
});

