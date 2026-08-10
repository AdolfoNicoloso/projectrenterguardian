import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGCard, PRGBadge, PRGHeader, useToast } from '../../../../../src/components';
import { reportsService } from '../../../../../src/services/reportsService';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';
import type { Report } from '../../../../../src/types';
import { formatDisplayDate } from '../../../../../src/utils/dateTime';

export default function ReportPreviewScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

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

  const handleOpenPdf = async () => {
    if (!report?.pdf_file) return;
    try {
      const { openReportPdf } = await import(
        '../../../../../src/services/reportsPdfService'
      );
      await openReportPdf(report.pdf_file, `report-${report.id}.pdf`);
    } catch (err) {
      console.error('Error opening report PDF:', err);
      showToast('Unable to open PDF', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!report?.pdf_file) return;
    try {
      const { downloadReportPdf } = await import(
        '../../../../../src/services/reportsPdfService'
      );
      await downloadReportPdf(report.pdf_file, `report-${report.id}.pdf`);
    } catch (err) {
      console.error('Error downloading report PDF:', err);
      showToast('Unable to download PDF', 'error');
    }
  };

  const handleGeneratePdf = async () => {
    if (!report?.id || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { generateReportPdf } = await import(
        '../../../../../src/services/reportsPdfService'
      );
      const updated = await generateReportPdf(report.id);
      setReport(updated);
      showToast(
        updated.pdf_file ? 'PDF ready' : 'PDF generation finished',
        'success'
      );
    } catch (err) {
      console.error('Error generating report PDF:', err);
      showToast('Unable to generate PDF. Try again.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <PRGHeader title="Report" showBack />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <PRGHeader title="Report" showBack />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Report not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <PRGHeader title="Report Details" showBack />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Report</Text>
        <PRGBadge
          label={report.status || 'draft'}
          variant={report.status === 'ready' ? 'success' : 'warning'}
        />
      </View>

      <PRGCard>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Generated</Text>
        <Text style={[styles.value, { color: colors.text }]}>{formatDate(report.date_created)}</Text>
      </PRGCard>

      {report.snapshot_json && (
        <PRGCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Report Contents</Text>
          <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
            {JSON.stringify(report.snapshot_json, null, 2)}
          </Text>
        </PRGCard>
      )}

      <PRGCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>PDF export</Text>
        <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
          Downloadable documentation PDF with text and photos from this snapshot.
        </Text>
        {report.pdf_file ? (
          <>
            <PRGButton
              title="Open PDF"
              onPress={() => {
                void handleOpenPdf();
              }}
              variant="primary"
              style={styles.button}
              disabled={pdfBusy}
            />
            <PRGButton
              title="Download PDF"
              onPress={() => {
                void handleDownloadPdf();
              }}
              variant="secondary"
              style={styles.button}
              disabled={pdfBusy}
            />
            <PRGButton
              title={pdfBusy ? 'Generating…' : 'Regenerate PDF'}
              onPress={() => {
                void handleGeneratePdf();
              }}
              variant="ghost"
              style={styles.button}
              disabled={pdfBusy}
            />
          </>
        ) : (
          <PRGButton
            title={pdfBusy ? 'Generating…' : 'Generate PDF'}
            onPress={() => {
              void handleGeneratePdf();
            }}
            variant="primary"
            style={styles.button}
            disabled={pdfBusy}
          />
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
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  jsonText: {
    fontSize: typography.fontSize.xs,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: spacing.md,
  },
});

