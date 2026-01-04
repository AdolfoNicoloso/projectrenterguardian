import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGHeader, PRGCard, PRGEmptyState, ScreenContainer } from '../../../src/components';
import { reportsService } from '../../../src/services/reportsService';
import { propertiesService } from '../../../src/services/propertiesService';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Report, Property } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/directusDate';

export default function ReportsListScreen() {
  const router = useRouter();
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string }>();
  const { colors } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [properties, setProperties] = useState<Record<string, Property>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      // Get all properties first
      const props = await propertiesService.getMyProperties();
      const propsMap: Record<string, Property> = {};
      props.forEach((p) => {
        propsMap[p.id] = p;
      });
      setProperties(propsMap);

      // Get reports for all properties
      const allReports: Report[] = [];
      for (const prop of props) {
        try {
          const propReports = await reportsService.getReports(prop.id);
          allReports.push(...propReports);
        } catch (error) {
          console.error(`Error loading reports for property ${prop.id}:`, error);
        }
      }

      // Sort by date_created descending
      allReports.sort((a, b) => {
        const dateA = a.date_created ? new Date(a.date_created).getTime() : 0;
        const dateB = b.date_created ? new Date(b.date_created).getTime() : 0;
        return dateB - dateA;
      });

      setReports(allReports);
    } catch (error) {
      console.error('Error loading reports:', error);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  const getPropertyName = (propertyId: string) => {
    const prop = properties[propertyId];
    return prop?.nickname || prop?.address_free_text || 'Unknown Property';
  };

  if (loading && reports.length === 0) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader title="Insights" showBack={false} />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader title="Insights" showBack={false} />
      {reports.length === 0 ? (
        <PRGEmptyState
          title="No reports yet"
          message="Complete an inspection to generate your first report"
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PRGCard
              onPress={() => router.push(`/(tabs)/insights/${item.id}`)}
              style={styles.card}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {getPropertyName(item.property)}
              </Text>
              <Text style={[styles.cardStatus, { color: colors.textSecondary }]}>
                Status: {item.status}
              </Text>
              {item.date_created && (
                <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                  Generated: {formatDate(item.date_created)}
                </Text>
              )}
            </PRGCard>
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
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cardStatus: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  cardDate: {
    fontSize: typography.fontSize.sm,
  },
});

