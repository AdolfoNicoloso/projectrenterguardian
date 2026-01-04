import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, PRGCard, PRGBadge, PRGHeader, useToast } from '../../../../../src/components';
import { reportsService } from '../../../../../src/services/reportsService';
import { colors, spacing, typography } from '../../../../../src/theme';
import type { Report } from '../../../../../src/types';
import { formatDisplayDate } from '../../../../../src/utils/directusDate';

export default function ReportPreviewScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reportId) {
      loadData();
    }
  }, [reportId]);

  const loadData = async () => {
    if (!reportId) return;
    try {
      const reportData = await reportsService.getReport(reportId);
      setReport(reportData);
    } catch (error) {
      console.error('Error loading report:', error);
      showToast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString, 'datetime') || 'N/A';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Report" showBack />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Report" showBack />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Report not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PRGHeader title="Report Details" showBack />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
          <Text style={styles.title}>Report</Text>
        <PRGBadge
          label={report.status || 'draft'}
          variant={report.status === 'ready' ? 'success' : 'warning'}
        />
      </View>

      <PRGCard>
        <Text style={styles.label}>Generated</Text>
        <Text style={styles.value}>{formatDate(report.date_created)}</Text>
      </PRGCard>

      {report.snapshot_json && (
        <PRGCard>
          <Text style={styles.sectionTitle}>Report Contents</Text>
          <Text style={styles.jsonText}>
            {JSON.stringify(report.snapshot_json, null, 2)}
          </Text>
        </PRGCard>
      )}

        {report.pdf_file && (
      <PRGButton
            title="Export PDF"
            onPress={() => {
              // TODO: Open PDF file
              showToast('PDF export not yet implemented', 'info');
            }}
            variant="primary"
        style={styles.button}
      />
        )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
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
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.dark,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
    color: colors.dark,
    fontWeight: typography.fontWeight.medium,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark,
    marginBottom: spacing.md,
  },
  jsonText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[700],
    fontFamily: 'monospace',
  },
  button: {
    marginTop: spacing.md,
  },
});

