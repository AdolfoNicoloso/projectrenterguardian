import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGHeader, PRGCard, PRGButton, PRGLoadingOverlay } from '../../../src/components';
import { reportsService } from '../../../src/services/reportsService';
import { colors, spacing, typography } from '../../../src/theme';
import type { Report } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/directusDate';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    if (!id) return;
    try {
      const data = await reportsService.getReport(id);
      setReport(data);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  const renderSnapshotJson = (snapshot: any) => {
    if (!snapshot) return <Text style={styles.emptyText}>No data available</Text>;

    return (
      <View>
        {Object.entries(snapshot).map(([key, value]) => (
          <View key={key} style={styles.jsonItem}>
            <Text style={styles.jsonKey}>{key}:</Text>
            <Text style={styles.jsonValue}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const handleOpenPDF = async () => {
    if (!report?.pdf_file) return;
    try {
      // In a real implementation, you'd construct the Directus file URL
      // For now, just show a message
      console.log('PDF file:', report.pdf_file);
    } catch (error) {
      console.error('Error opening PDF:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Report" showBack />
        <PRGLoadingOverlay />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Report" showBack />
        <View style={styles.errorContainer}>
          <Text>Report not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PRGHeader title="Report Details" showBack />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <PRGCard>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{report.status}</Text>
        </PRGCard>

        {report.date_created && (
          <PRGCard>
            <Text style={styles.label}>Generated</Text>
            <Text style={styles.value}>{formatDate(report.date_created)}</Text>
          </PRGCard>
        )}

        {report.snapshot_json && (
          <PRGCard>
            <Text style={styles.label}>Report Data</Text>
            {renderSnapshotJson(report.snapshot_json)}
          </PRGCard>
        )}

        {report.pdf_file && (
          <PRGButton
            title="Open PDF"
            onPress={handleOpenPDF}
            variant="primary"
            style={styles.pdfButton}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
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
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[500],
    fontStyle: 'italic',
  },
  jsonItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  jsonKey: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  jsonValue: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    fontFamily: 'monospace',
  },
  pdfButton: {
    marginTop: spacing.md,
  },
});

