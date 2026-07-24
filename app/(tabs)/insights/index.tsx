import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  PRGHeader,
  PRGCard,
  PRGEmptyState,
  PRGBadge,
  ScreenContainer,
  NotificationsBellGlyph,
  useWebPageContentStyle,
} from '../../../src/components';
import { reportsService } from '../../../src/services/reportsService';
import { propertiesService } from '../../../src/services/propertiesService';
import { Routes } from '../../../src/navigation/routes';
import { spacing, typography, layout } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Report, Property } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/cmsDateTime';
import { propertyDisplayName } from '../../../src/constants/propertyStatuses';

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

export default function ReportsListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const listContentStyle = useWebPageContentStyle(styles.listContent, layout.contentMaxWidth);
  const [reports, setReports] = useState<Report[]>([]);
  const [properties, setProperties] = useState<Record<string, Property>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const props = await propertiesService.getMyProperties();
      const propsMap: Record<string, Property> = {};
      props.forEach((p) => {
        propsMap[p.id] = p;
      });
      setProperties(propsMap);

      const allReports: Report[] = [];
      for (const prop of props) {
        try {
          const propReports = await reportsService.getReports(prop.id);
          allReports.push(...propReports);
        } catch (loadError) {
          console.error(`Error loading reports for property ${prop.id}:`, loadError);
        }
      }

      allReports.sort((a, b) => {
        const dateA = a.date_created ? new Date(a.date_created).getTime() : 0;
        const dateB = b.date_created ? new Date(b.date_created).getTime() : 0;
        return dateB - dateA;
      });

      setReports(allReports);
    } catch (loadError) {
      console.error('Error loading reports:', loadError);
      setError('Could not load reports. Pull to refresh or try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const getPropertyName = (propertyId: string) => {
    const prop = properties[propertyId];
    if (!prop) return 'Unknown property';
    return propertyDisplayName(prop);
  };

  if (loading && reports.length === 0) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader
          title="Reports"
          showBack={false}
          rightAction={{
            icon: <NotificationsBellGlyph />,
            onPress: () => router.push(Routes.NOTIFICATIONS as never),
            accessibilityLabel: 'Open notifications',
          }}
        />
        <View style={styles.loadingContainer} accessibilityLabel="Loading reports">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading reports…
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader
        title="Reports"
        showBack={false}
        rightAction={{
          icon: <NotificationsBellGlyph />,
          onPress: () => router.push(Routes.NOTIFICATIONS as never),
          accessibilityLabel: 'Open notifications',
        }}
      />
      {error && reports.length === 0 ? (
        <PRGEmptyState
          title="Couldn't load reports"
          message={error}
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            loadReports();
          }}
        />
      ) : reports.length === 0 ? (
        <PRGEmptyState
          title="No reports yet"
          message="Complete a guided inspection to save a report you can review later."
          actionLabel="Start an inspection"
          onAction={() => router.push(Routes.INSPECTIONS.NEW)}
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PRGCard
              onPress={() => router.push(Routes.REPORTS.DETAIL(item.id))}
              style={styles.card}
              accessibilityLabel={`Report for ${getPropertyName(item.property)}, status ${statusLabel(item.status)}`}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {getPropertyName(item.property)}
                </Text>
                <PRGBadge label={statusLabel(item.status)} variant={statusBadgeVariant(item.status)} />
              </View>
              {item.date_created ? (
                <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                  Saved {formatDisplayDate(item.date_created) || 'N/A'}
                </Text>
              ) : null}
              <Text style={[styles.cardHint, { color: colors.primary }]}>View report</Text>
            </PRGCard>
          )}
          contentContainerStyle={listContentStyle}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
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
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
  },
  cardDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  cardHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
});
