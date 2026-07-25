import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  PRGHeader,
  PRGCard,
  PRGButton,
  PRGBadge,
  PRGEmptyState,
  useToast,
} from '../../../src/components';
import { reportsService } from '../../../src/services/reportsService';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Report } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/dateTime';

function statusBadgeVariant(
  status: Report['status']
): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'ready') return 'success';
  if (status === 'generating' || status === 'draft') return 'warning';
  if (status === 'failed') return 'error';
  return 'default';
}

function statusLabel(status: Report['status']): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'generating':
      return 'Generating';
    case 'draft':
      return 'Draft';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
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
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const renderSnapshotSummary = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== 'object') {
      return (
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          No snapshot data available.
        </Text>
      );
    }

    const snap = snapshot as Record<string, unknown>;
    const counts =
      snap.counts && typeof snap.counts === 'object'
        ? (snap.counts as Record<string, unknown>)
        : null;

    const countRows: { label: string; value: string }[] = [];
    if (counts) {
      if (counts.spaces_count != null) {
        countRows.push({ label: 'Spaces', value: String(counts.spaces_count) });
      }
      if (counts.overview_photos_count != null) {
        countRows.push({
          label: 'Overview photos',
          value: String(counts.overview_photos_count),
        });
      }
      if (counts.space_photos_count != null) {
        countRows.push({
          label: 'Space photos',
          value: String(counts.space_photos_count),
        });
      }
      if (counts.total_photos_count != null) {
        countRows.push({
          label: 'Total photos',
          value: String(counts.total_photos_count),
        });
      }
      if (counts.notes_count != null) {
        countRows.push({ label: 'Notes', value: String(counts.notes_count) });
      }
    }

    const inspection =
      snap.inspection && typeof snap.inspection === 'object'
        ? (snap.inspection as Record<string, unknown>)
        : null;

    return (
      <View>
        {inspection?.type_label ? (
          <View style={[styles.jsonItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.jsonKey, { color: colors.text }]}>Type</Text>
            <Text style={[styles.jsonValue, { color: colors.textSecondary }]}>
              {String(inspection.type_label)}
            </Text>
          </View>
        ) : null}
        {countRows.map((row) => (
          <View
            key={row.label}
            style={[styles.jsonItem, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.jsonKey, { color: colors.text }]}>{row.label}</Text>
            <Text style={[styles.jsonValue, { color: colors.textSecondary }]}>
              {row.value}
            </Text>
          </View>
        ))}
        {typeof snap.user_summary_notes === 'string' && snap.user_summary_notes.trim() ? (
          <View style={[styles.jsonItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.jsonKey, { color: colors.text }]}>Summary notes</Text>
            <Text style={[styles.jsonValue, { color: colors.textSecondary }]} numberOfLines={8}>
              {snap.user_summary_notes}
            </Text>
          </View>
        ) : null}
        {!counts ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Older reports may not include summary counts. Raw snapshot fields are still saved.
          </Text>
        ) : null}
      </View>
    );
  };

  const handleExportPdf = () => {
    if (!report?.pdf_file) return;
    showToast('Unable to open PDF yet. Try again after the next update.', 'error');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Report" showBack />
        <View style={styles.centered} accessibilityLabel="Loading report">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Report" showBack />
        <PRGEmptyState
          title="Report not found"
          message="This report may have been deleted or is no longer available."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Report" showBack />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <PRGCard>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
            <PRGBadge
              label={statusLabel(report.status)}
              variant={statusBadgeVariant(report.status)}
            />
          </View>
        </PRGCard>

        {report.date_created ? (
          <PRGCard>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Saved</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {formatDisplayDate(report.date_created) || 'N/A'}
            </Text>
          </PRGCard>
        ) : null}

        <PRGCard>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Snapshot</Text>
          <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
            This is your saved documentation record. It is not legal advice or a professional
            inspection.
          </Text>
          {renderSnapshotSummary(report.snapshot_json)}
        </PRGCard>

        <PRGCard>
          <Text style={[styles.label, { color: colors.textSecondary }]}>PDF export</Text>
          {report.pdf_file ? (
            <PRGButton
              title="Open PDF"
              onPress={handleExportPdf}
              variant="primary"
              style={styles.pdfButton}
              accessibilityLabel="Open PDF report"
            />
          ) : (
            <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
              A downloadable PDF will be available here once report export is enabled for your
              account. Your snapshot above is already saved.
            </Text>
          )}
        </PRGCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  disclaimer: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },
  jsonItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  jsonKey: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  jsonValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  pdfButton: {
    marginTop: spacing.md,
  },
});
