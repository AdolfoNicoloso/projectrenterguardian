import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PRGButton, PRGCard, PRGBadge, PRGEmptyState, useToast } from '../components';
import { reportsService } from '../services/reportsService';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Report } from '../types';
import { formatDisplayDate } from '../utils/cmsDateTime';

interface PropertyReportProps {
  propertyId: string;
}

export const PropertyReport: React.FC<PropertyReportProps> = ({ propertyId }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const reportsData = await reportsService.getReports(propertyId);
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [propertyId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  const getStatusVariant = (status?: string): 'default' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'generating':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Report Archive</Text>
        {reports.length === 0 ? (
          <PRGEmptyState
            title="No Reports"
            message="Complete an inspection to generate a report"
          />
        ) : (
          reports.map((report) => (
            <PRGCard
              key={report.id}
              onPress={() => router.push(`/(tabs)/insights/${report.id}`)}
              style={styles.reportCard}
            >
              <View style={styles.reportRow}>
                <View style={styles.reportInfo}>
                  <Text style={[styles.reportDate, { color: colors.text }]}>
                    {formatDate(report.date_created)}
                  </Text>
                  <PRGBadge
                    label={report.status || 'draft'}
                    variant={getStatusVariant(report.status)}
                    style={styles.badge}
                  />
                </View>
                {report.status === 'ready' && (
                  <PRGButton
                    title="View"
                    onPress={() => router.push(`/(tabs)/insights/${report.id}`)}
                    variant="ghost"
                  />
                )}
              </View>
            </PRGCard>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportCard: {
    marginBottom: spacing.sm,
  },
  reportInfo: {
    flex: 1,
  },
  reportDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  badge: {
    marginTop: spacing.xs,
  },
});


