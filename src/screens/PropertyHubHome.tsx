import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRGEmptyState,
  PRGHeader,
  PRGInput,
  ScreenContainer,
  CalendarIcon,
  NotificationsBellGlyph,
  useWebPageContentStyle,
  useToast,
} from '../components';
import { inspectionsService } from '../services/inspectionsService';
import { useAuthStore } from '../state/authStore';
import { usePropertiesStore } from '../state/propertiesStore';
import { usePropertiesList } from '../hooks/usePropertiesQuery';
import { spacing } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Inspection, Property } from '../types';
import { Routes } from '../navigation/routes';
import { getInspectionTypeLabel } from '../constants/inspectionTypes';
import {
  isActivePropertyStatus,
  isTouringPropertyStatus,
  isToursHubPropertyStatus,
  propertyDisplayName,
} from '../constants/propertyStatuses';
import {
  hasTourScheduledAt,
  sortTouringProperties,
} from '../utils/tourSchedule';
import { HubPromptModal } from './propertyHub/HubPromptModal';
import { ToursFilterChips } from './propertyHub/ToursFilterChips';
import { ToursPropertyList } from './propertyHub/ToursPropertyList';
import { RentsPropertyList } from './propertyHub/RentsPropertyList';
import { propertyHubStyles as styles } from './propertyHub/propertyHubStyles';
import {
  markTourSchedulePromptShown,
  propertyMatchesSearch,
  propertyMatchesToursFilter,
  shouldShowTourSchedulePrompt,
} from './propertyHub/propertyHubSearch';
import {
  type PropertyHubHomeProps,
  type PropertyHubMode,
  type ToursListFilter,
} from './propertyHub/types';

export type { PropertyHubMode };

/**
 * Rents or Tours hub list (replaces the former Home segment control).
 */
export function PropertyHubHome({ mode }: PropertyHubHomeProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const listContentStyle = useWebPageContentStyle(styles.listContent);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const {
    data: properties,
    isInitialLoading,
    isRefreshing,
    error,
    revalidate,
  } = usePropertiesList();
  const isTours = mode === 'tours';
  const [searchQuery, setSearchQuery] = useState('');
  const [toursFilters, setToursFilters] = useState<ToursListFilter[]>([]);
  const [showFirstInspectionCTA, setShowFirstInspectionCTA] = useState(false);
  const [firstPropertyId, setFirstPropertyId] = useState<string | null>(null);
  const [finishDraft, setFinishDraft] = useState<Inspection | null>(null);
  const [tourPromptProperty, setTourPromptProperty] = useState<Property | null>(null);
  const [showOtherProperties, setShowOtherProperties] = useState(false);
  /** propertyId → incomplete tour inspection id */
  const [incompleteTourByPropertyId, setIncompleteTourByPropertyId] = useState<
    Record<string, string>
  >({});
  const bootPromptsShown = useRef(false);

  const listIdsKey = useMemo(
    () => properties.map((p) => `${p.id}:${p.status ?? ''}`).join('|'),
    [properties]
  );

  const { showToast } = useToast();
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const [markingAppliedId, setMarkingAppliedId] = useState<string | null>(null);
  const { active, touring, other } = useMemo(() => {
    const nextActive: Property[] = [];
    const nextTouring: Property[] = [];
    const nextOther: Property[] = [];
    for (const property of properties) {
      if (isActivePropertyStatus(property.status)) nextActive.push(property);
      else if (isToursHubPropertyStatus(property.status)) nextTouring.push(property);
      else nextOther.push(property);
    }

    // Upcoming → toured → not scheduled. Applied stays with Tours hub list.
    return {
      active: nextActive,
      touring: sortTouringProperties(nextTouring),
      other: nextOther,
    };
  }, [properties]);

  const {
    active: visibleActive,
    touring: visibleTouring,
    other: visibleOther,
  } = useMemo(() => {
    const q = searchQuery.trim();
    let nextActive = active;
    let nextTouring = touring;
    let nextOther = other;
    if (q) {
      nextActive = active.filter((p) => propertyMatchesSearch(p, q));
      nextTouring = touring.filter((p) => propertyMatchesSearch(p, q));
      nextOther = other.filter((p) => propertyMatchesSearch(p, q));
    }
    if (isTours && toursFilters.length > 0) {
      nextTouring = nextTouring.filter((p) =>
        toursFilters.some((f) => propertyMatchesToursFilter(p, f))
      );
    }
    return {
      active: nextActive,
      touring: nextTouring,
      other: nextOther,
    };
  }, [active, touring, other, searchQuery, isTours, toursFilters]);

  const toggleToursFilter = useCallback((filter: ToursListFilter) => {
    setToursFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  }, []);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasToursFilters = isTours && toursFilters.length > 0;
  const hasVisibleInView = isTours
    ? visibleTouring.length > 0
    : visibleActive.length > 0 || visibleOther.length > 0;
  const showOtherSection = showOtherProperties || (hasSearchQuery && visibleOther.length > 0);

  const headerRightActions = useMemo(() => {
    const actions: Array<{
      label?: string;
      icon?: React.ReactNode;
      onPress: () => void;
      accessibilityLabel?: string;
    }> = [];
    actions.push({
      icon: <NotificationsBellGlyph />,
      onPress: () => router.push(Routes.NOTIFICATIONS as never),
      accessibilityLabel: 'Open notifications',
    });
    if (isTours) {
      actions.push({
        icon: <CalendarIcon size={22} color={colors.primary} />,
        onPress: () => router.push(Routes.PROPERTIES.TOURS_CALENDAR),
        accessibilityLabel: 'Open tour calendar',
      });
    }
    actions.push({
      label: 'Add',
      onPress: () => router.push(Routes.PROPERTIES.CREATE),
    });
    return actions;
  }, [isTours, colors.primary, router]);

  const touringIdsKey = useMemo(
    () => touring.map((p) => p.id).join('|'),
    [touring]
  );

  const loadIncompleteTours = useCallback(async () => {
    if (!isTours || !isAuthenticated || authLoading || touring.length === 0) {
      setIncompleteTourByPropertyId({});
      return;
    }
    try {
      const drafts = await inspectionsService.getMyInspections({
        status: 'in_progress',
      });
      const touringIds = new Set(touring.map((p) => p.id));
      const tourDrafts = drafts
        .filter(
          (d) =>
            (d.inspection_type || '').toLowerCase() === 'tour' &&
            touringIds.has(d.property_id)
        )
        .sort((a, b) => {
          const aTime = Date.parse(a.date_updated || a.started_at || '') || 0;
          const bTime = Date.parse(b.date_updated || b.started_at || '') || 0;
          return bTime - aTime;
        });
      const next: Record<string, string> = {};
      for (const draft of tourDrafts) {
        if (!next[draft.property_id]) {
          next[draft.property_id] = draft.id;
        }
      }
      setIncompleteTourByPropertyId(next);
    } catch (err) {
      console.error('Error loading incomplete tour inspections:', err);
    }
  }, [authLoading, isAuthenticated, isTours, touring]);

  useFocusEffect(
    useCallback(() => {
      if (isTours) void loadIncompleteTours();
    }, [isTours, loadIncompleteTours])
  );

  useEffect(() => {
    if (isTours) void loadIncompleteTours();
  }, [isTours, loadIncompleteTours, touringIdsKey]);

  // Move-In CTA: Active property with no inspections yet (Rents tab only).
  useEffect(() => {
    if (isTours || !isAuthenticated || authLoading) return;

    let cancelled = false;
    (async () => {
      const activeProperty = properties.find((p) => isActivePropertyStatus(p.status));
      if (!activeProperty) {
        if (!cancelled) {
          setShowFirstInspectionCTA((prev) => (prev ? false : prev));
          setFirstPropertyId((prev) => (prev !== null ? null : prev));
        }
        return;
      }
      try {
        const hasInspections = await inspectionsService.propertyHasInspections(
          activeProperty.id
        );
        if (cancelled) return;
        setFirstPropertyId(activeProperty.id);
        setShowFirstInspectionCTA(!hasInspections);
      } catch (inspectionError) {
        console.error('Error checking inspections:', inspectionError);
        if (cancelled) return;
        setFirstPropertyId(activeProperty.id);
        setShowFirstInspectionCTA(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally keyed by list identity, not the properties array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTours, listIdsKey, isAuthenticated, authLoading]);

  // Boot prompts: unfinished draft on Rents; tour schedule on Tours.
  useEffect(() => {
    if (authLoading || !isAuthenticated || bootPromptsShown.current) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (isTours) {
          const props = await usePropertiesStore.getState().fetchList({ force: false });
          if (cancelled) return;
          bootPromptsShown.current = true;

          const needsSchedule = props
            .filter((p) => isTouringPropertyStatus(p.status) && !hasTourScheduledAt(p))
            .sort((a, b) => {
              const aTime = Date.parse(a.date_updated || a.date_created || '') || 0;
              const bTime = Date.parse(b.date_updated || b.date_created || '') || 0;
              return bTime - aTime;
            });
          if (needsSchedule.length > 0 && (await shouldShowTourSchedulePrompt())) {
            await markTourSchedulePromptShown();
            if (cancelled) return;
            setTourPromptProperty(needsSchedule[0]);
          }
          return;
        }

        const drafts = await inspectionsService.getMyInspections({ status: 'in_progress' });
        if (cancelled) return;
        bootPromptsShown.current = true;

        if (drafts.length > 0) {
          const sorted = [...drafts].sort((a, b) => {
            const aTime = Date.parse(a.date_updated || a.started_at || '') || 0;
            const bTime = Date.parse(b.date_updated || b.started_at || '') || 0;
            return bTime - aTime;
          });
          setFinishDraft(sorted[0]);
        }
      } catch (err) {
        console.error('Error checking boot prompts:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isTours]);

  const continueDraftInspection = () => {
    if (!finishDraft) return;
    const draftId = finishDraft.id;
    setFinishDraft(null);
    router.push(`/(tabs)/inspections/${draftId}`);
  };

  const openTourSchedule = () => {
    if (!tourPromptProperty) return;
    const propertyId = tourPromptProperty.id;
    setTourPromptProperty(null);
    router.push(
      `/(tabs)/properties/${encodeURIComponent(propertyId)}?editTour=1`
    );
  };

  const markAsApplied = async (property: Property) => {
    if (markingAppliedId) return;
    setMarkingAppliedId(property.id);
    try {
      await updateProperty(property.id, { status: 'applied' });
      showToast('Marked as Applied', 'success');
    } catch (err) {
      console.error('Error marking property as applied:', err);
      showToast('Failed to update status', 'error');
    } finally {
      setMarkingAppliedId(null);
    }
  };

  const tourPromptLabel = tourPromptProperty
    ? propertyDisplayName(tourPromptProperty)
    : 'this property';

  const screenTitle = isTours ? 'Tours' : 'Rents';

  if (authLoading || (isInitialLoading && properties.length === 0)) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader
          title={screenTitle}
          showBack={false}
          rightActions={headerRightActions}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader
        title={screenTitle}
        showBack={false}
        rightActions={headerRightActions}
      />
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
      {properties.length === 0 && !isInitialLoading && !error ? (
        <PRGEmptyState
          title={isTours ? 'Add your first tour' : 'Add your first rental'}
          message={
            isTours
              ? 'Tour places you’re considering and document what you see room by room.'
              : 'Add the place you’re renting and document it room by room when you’re ready.'
          }
          actionLabel="Add Property"
          onAction={() => router.push(Routes.PROPERTIES.CREATE)}
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            listContentStyle,
            {
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void revalidate(true);
                if (isTours) void loadIncompleteTours();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <PRGInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              isTours
                ? 'Search tours by nickname or address'
                : 'Search rentals by nickname or address'
            }
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search properties by nickname or address"
            containerStyle={
              isTours ? styles.searchInputWithFilters : styles.searchInput
            }
          />

          {isTours ? (
            <ToursFilterChips
              selected={toursFilters}
              onToggle={toggleToursFilter}
            />
          ) : null}

          {(hasSearchQuery || hasToursFilters) && !hasVisibleInView ? (
            <View style={styles.section}>
              <Text style={[styles.hubIntro, { color: colors.textSecondary }]}>
                {hasSearchQuery
                  ? `No ${isTours ? 'tours' : 'rentals'} match “${searchQuery.trim()}”.`
                  : 'No tours match these filters.'}
              </Text>
            </View>
          ) : null}

          {isTours ? (
            <ToursPropertyList
              properties={visibleTouring}
              incompleteTourByPropertyId={incompleteTourByPropertyId}
              markingAppliedId={markingAppliedId}
              hasSearchQuery={hasSearchQuery}
              onMarkApplied={(property) => {
                void markAsApplied(property);
              }}
            />
          ) : (
            <RentsPropertyList
              activeProperties={visibleActive}
              otherProperties={other}
              visibleOther={visibleOther}
              firstPropertyId={firstPropertyId}
              showFirstInspectionCTA={showFirstInspectionCTA}
              showOtherProperties={showOtherProperties}
              showOtherSection={showOtherSection}
              hasSearchQuery={hasSearchQuery}
              onToggleArchived={() => setShowOtherProperties((v) => !v)}
            />
          )}
        </ScrollView>
      )}

      <HubPromptModal
        visible={!!finishDraft}
        title="Ready to finish your inspection?"
        body={
          finishDraft
            ? `Your ${getInspectionTypeLabel(finishDraft.inspection_type).toLowerCase()} draft is ${finishDraft.inspections_progress}% complete. Continue where you left off, or come back later.`
            : ''
        }
        primaryLabel="Yes, continue"
        primaryAccessibilityLabel="Continue unfinished inspection"
        secondaryAccessibilityLabel="Keep draft and close"
        onPrimary={continueDraftInspection}
        onDismiss={() => setFinishDraft(null)}
      />

      <HubPromptModal
        visible={!!tourPromptProperty}
        title={`Do you have a tour scheduled for ${tourPromptLabel}?`}
        body="Add your scheduled time now to get a reminder!"
        primaryLabel="Add scheduled time"
        primaryAccessibilityLabel="Add scheduled tour time"
        secondaryAccessibilityLabel="Skip scheduling for now"
        onPrimary={openTourSchedule}
        onDismiss={() => setTourPromptProperty(null)}
      />
    </ScreenContainer>
  );
}
