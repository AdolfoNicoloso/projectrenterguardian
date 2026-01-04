import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, SectionList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRGButton, PRGCard, PRGEmptyState, PRGHeader, ScreenContainer, InspectionCTA_Banner } from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { useAuthStore } from '../../../src/state/authStore';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Property } from '../../../src/types';
import { Routes } from '../../../src/navigation/routes';
import { formatDisplayDate } from '../../../src/utils/directusDate';

export default function PropertiesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFirstInspectionCTA, setShowFirstInspectionCTA] = useState(false);
  const [firstPropertyId, setFirstPropertyId] = useState<string | null>(null);
  const [isCTADismissed, setIsCTADismissed] = useState(false);

  const loadProperties = async () => {
    try {
      setError(null);
      const data = await propertiesService.getMyProperties();
      setProperties(data);

      // Check first inspection CTA for active property (or first property if no active)
      if (data.length > 0) {
        const activeProperty = data.find(p => p.status?.toLowerCase() === 'active') || data[0];
        setFirstPropertyId(activeProperty.id);
        
        try {
          const hasInspections = await inspectionsService.propertyHasInspections(activeProperty.id);
          // Reset dismissed state when properties refresh (so CTA shows again on refresh)
          setIsCTADismissed(false);
          setShowFirstInspectionCTA(!hasInspections);
        } catch (inspectionError) {
          console.error('Error checking inspections:', inspectionError);
          // Default to showing CTA on error (safe MVP behavior)
          setIsCTADismissed(false);
          setShowFirstInspectionCTA(true);
        }
      } else {
        setShowFirstInspectionCTA(false);
        setFirstPropertyId(null);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only load properties when auth is ready and user is authenticated
    if (!authLoading && isAuthenticated) {
      loadProperties();
    } else if (!authLoading && !isAuthenticated) {
      // Auth is ready but user is not authenticated - stop loading
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  // Refetch properties when screen comes into focus
  // This ensures we see the latest data after creating/updating/deleting properties
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && isAuthenticated) {
        loadProperties();
      }
    }, [authLoading, isAuthenticated])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProperties();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDisplayDate(dateString) || 'N/A';
  };

  // Group properties by status
  const groupedProperties = useMemo(() => {
    const active: Property[] = [];
    const draft: Property[] = [];
    const archived: Property[] = [];

    properties.forEach((property) => {
      const status = property.status?.toLowerCase() || 'draft';
      if (status === 'active') {
        active.push(property);
      } else if (status === 'archived') {
        archived.push(property);
      } else {
        draft.push(property);
      }
    });

    const sections: Array<{ title: string; data: Property[] }> = [];
    
    if (active.length > 0) {
      sections.push({ title: 'Active', data: active });
    }
    if (draft.length > 0) {
      sections.push({ title: 'Draft', data: draft });
    }
    if (archived.length > 0) {
      sections.push({ title: 'Archived', data: archived });
    }

    return sections;
  }, [properties]);

  if (loading && properties.length === 0) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader
          title="Properties"
          showBack={false}
          rightAction={{
            label: 'Add',
            onPress: () => router.push('/(tabs)/properties/property-info'),
          }}
        />
        <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader
        title="Properties"
        showBack={false}
        rightAction={{
          label: 'Add',
          onPress: () => router.push('/(tabs)/properties/property-info'),
        }}
      />
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
      {properties.length === 0 && !loading && !error ? (
        <PRGEmptyState
          title="Create your first property!"
          message="Get started by adding your first property"
          actionLabel="Add Property"
          onAction={() => router.push('/(tabs)/properties/property-info')}
        />
      ) : (
        <SectionList
          sections={groupedProperties}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PRGCard
              onPress={() => router.push(Routes.PROPERTIES.DETAIL(item.id))}
              style={styles.card}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.nickname || item.address_free_text}
              </Text>
              <Text style={[styles.cardAddress, { color: colors.textSecondary }]}>{item.address_free_text}</Text>
              <View style={styles.cardDates}>
                <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                  Start: {formatDate(item.lease_start_date)}
                </Text>
                {item.lease_end_date && (
                  <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                    End: {formatDate(item.lease_end_date)}
                  </Text>
                )}
              </View>
            </PRGCard>
          )}
          renderSectionHeader={({ section }) => {
            const dividerColor = 'rgba(111, 0, 255, 0.8)'; // Primary color #6F00FF at 80% opacity
            return (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderWithDivider}>
                  <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />
                  <Text style={[styles.sectionTitle, styles.sectionTitleOnDivider, { color: dividerColor, backgroundColor: colors.background }]}>
                    {section.title}
                  </Text>
                </View>
              </View>
            );
          }}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { 
              paddingBottom: insets.bottom + spacing.md + 
                (showFirstInspectionCTA && firstPropertyId && !isCTADismissed ? 100 : 0)
            }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
      {showFirstInspectionCTA && firstPropertyId && !isCTADismissed && (
        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + spacing.md }]}>
          <InspectionCTA_Banner
            onPress={() => router.push('/onboarding/inspection-ready?propertyId=' + firstPropertyId)}
            onDismiss={() => setIsCTADismissed(true)}
          />
        </View>
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
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sectionHeaderWithDivider: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    top: '50%',
  },
  sectionTitleOnDivider: {
    paddingHorizontal: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  cardAddress: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  cardDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  errorContainer: {
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: 8,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});


