import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRGBadge,
  PRGButton,
  PRGCard,
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
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Inspection, Property } from '../types';
import { Routes } from '../navigation/routes';
import { getInspectionTypeLabel } from '../constants/inspectionTypes';
import {
  isActivePropertyStatus,
  isTouringPropertyStatus,
  isToursHubPropertyStatus,
  isAppliedPropertyStatus,
  getPropertyStatusLabel,
  propertyDisplayName,
  formatPropertyAddress,
} from '../constants/propertyStatuses';
import { formatDisplayDate } from '../utils/cmsDateTime';
import {
  getTourScheduleBucket,
  getToursHubStage,
  hasTourScheduledAt,
  sortTouringProperties,
} from '../utils/tourSchedule';

/** Device-local throttle for the Tours “tour scheduled?” boot modal. */
const TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY = 'tour_schedule_prompt_last_shown_at';
const TOUR_SCHEDULE_PROMPT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

async function shouldShowTourSchedulePrompt(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY);
    if (!raw) return true;
    const lastShown = Date.parse(raw);
    if (!Number.isFinite(lastShown)) return true;
    return Date.now() - lastShown >= TOUR_SCHEDULE_PROMPT_THROTTLE_MS;
  } catch {
    return true;
  }
}

async function markTourSchedulePromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Error persisting tour schedule prompt throttle:', err);
  }
}

function propertyMatchesSearch(property: Property, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    property.nickname,
    property.address_free_text,
    property.street,
    property.unit,
    property.city,
    property.state_code,
    property.zip != null ? String(property.zip) : null,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export type PropertyHubMode = 'rents' | 'tours';

type ToursListFilter = 'scheduled' | 'toured' | 'applied';

const TOURS_FILTER_TAGS: Array<{ id: ToursListFilter; label: string }> = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'toured', label: 'Toured' },
  { id: 'applied', label: 'Applied' },
];

function propertyMatchesToursFilter(
  property: Property,
  filter: ToursListFilter
): boolean {
  if (filter === 'applied') {
    return isAppliedPropertyStatus(property.status);
  }
  const bucket = getTourScheduleBucket(property);
  if (filter === 'scheduled') return bucket === 'upcoming';
  return bucket === 'toured';
}

type PropertyHubHomeProps = {
  mode: PropertyHubMode;
};

/**
 * Rents or Tours hub list (replaces the former Home segment control).
 */
export function PropertyHubHome({ mode }: PropertyHubHomeProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isDesktop = useDesktopLayout();
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
            <View
              style={styles.filterRow}
              accessibilityRole="tablist"
              accessibilityLabel="Filter tours"
            >
              {TOURS_FILTER_TAGS.map((tag) => {
                const selected = toursFilters.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleToursFilter(tag.id)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary + '18'
                          : colors.backgroundSecondary,
                      },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter ${tag.label}`}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: selected ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
            <>
              {visibleTouring.length > 0 ? (
                <View style={styles.section}>
                  <View style={isDesktop ? styles.cardGrid : undefined}>
                    {visibleTouring.map((property) => {
                      const canEdit =
                        !property.my_role ||
                        property.my_role === 'owner' ||
                        property.my_role === 'edit';
                      const isTouring = isTouringPropertyStatus(property.status);
                      const incompleteTourId = incompleteTourByPropertyId[property.id];
                      const stage = getToursHubStage(property);
                      return (
                        <View
                          key={property.id}
                          style={isDesktop ? styles.cardGridItem : undefined}
                        >
                          <PropertyHubCard
                            property={property}
                            stageLabel={stage.label}
                            stageVariant={stage.variant}
                            stageDetail={
                              stage.showTourAt
                                ? formatDisplayDate(property.tour_scheduled_at, 'datetime')
                                : undefined
                            }
                            primaryAction={
                              canEdit
                                ? incompleteTourId
                                  ? {
                                      label: 'Continue tour',
                                      onPress: () =>
                                        router.push(
                                          `/(tabs)/inspections/${encodeURIComponent(incompleteTourId)}`
                                        ),
                                    }
                                  : {
                                      label: 'Start Tour',
                                      onPress: () =>
                                        router.push(
                                          `/(tabs)/inspections/new?propertyId=${encodeURIComponent(property.id)}&inspectionType=tour`
                                        ),
                                    }
                                : undefined
                            }
                            secondaryAction={
                              canEdit && isTouring
                                ? {
                                    label:
                                      markingAppliedId === property.id
                                        ? 'Updating…'
                                        : 'Applied?',
                                    onPress: () => {
                                      void markAsApplied(property);
                                    },
                                    disabled: markingAppliedId === property.id,
                                  }
                                : undefined
                            }
                            onOpen={() => router.push(Routes.PROPERTIES.DETAIL(property.id))}
                            compact={isDesktop}
                          />
                        </View>
                      );
                    })}
                    {isDesktop && !hasSearchQuery ? (
                      <View style={styles.cardGridItem}>
                        <AddPropertyCard onPress={() => router.push(Routes.PROPERTIES.CREATE)} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : !hasSearchQuery ? (
                <PRGEmptyState
                  title="No tours yet"
                  message="Add a touring property to schedule walkthroughs and document what you see."
                  actionLabel="Add touring property"
                  onAction={() => router.push(Routes.PROPERTIES.CREATE)}
                />
              ) : null}
            </>
          ) : (
            <>
              {visibleActive.length > 0 ? (
                <View style={styles.section}>
                  <View style={isDesktop ? styles.cardGrid : undefined}>
                    {visibleActive.map((property) => {
                      const canEdit =
                        !property.my_role ||
                        property.my_role === 'owner' ||
                        property.my_role === 'edit';
                      return (
                        <View
                          key={property.id}
                          style={isDesktop ? styles.cardGridItem : undefined}
                        >
                          <PropertyHubCard
                            property={property}
                            statusLabel={
                              property.my_role === 'view'
                                ? 'Shared · View'
                                : property.my_role === 'edit'
                                  ? 'Shared · Edit'
                                  : 'Active'
                            }
                            primaryAction={
                              canEdit
                                ? firstPropertyId === property.id && showFirstInspectionCTA
                                  ? {
                                      label: 'Start Move-In inspection',
                                      onPress: () =>
                                        router.push(
                                          '/onboarding/inspection-ready?propertyId=' + property.id
                                        ),
                                    }
                                  : {
                                      label: 'Start inspection',
                                      onPress: () =>
                                        router.push(
                                          `/(tabs)/inspections/new?propertyId=${encodeURIComponent(property.id)}`
                                        ),
                                    }
                                : undefined
                            }
                            onOpen={() => router.push(Routes.PROPERTIES.DETAIL(property.id))}
                            compact={isDesktop}
                          />
                        </View>
                      );
                    })}
                    {isDesktop && !hasSearchQuery ? (
                      <View style={styles.cardGridItem}>
                        <AddPropertyCard onPress={() => router.push(Routes.PROPERTIES.CREATE)} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : !hasSearchQuery && other.length === 0 ? (
                <PRGEmptyState
                  title="No rentals yet"
                  message="Add the place you’re renting, or convert a tour when you choose a place."
                  actionLabel="Add rental"
                  onAction={() => router.push(Routes.PROPERTIES.CREATE)}
                />
              ) : !hasSearchQuery && visibleActive.length === 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.hubIntro, { color: colors.textSecondary }]}>
                    No active rentals yet. Add one, or open a draft below.
                  </Text>
                </View>
              ) : null}

              {visibleOther.length > 0 ? (
                <View style={styles.section}>
                  {!hasSearchQuery ? (
                    <PRGButton
                      title={
                        showOtherProperties
                          ? 'Hide archived'
                          : `Archived (${other.length})`
                      }
                      onPress={() => setShowOtherProperties((v) => !v)}
                      variant="ghost"
                      style={styles.otherToggle}
                    />
                  ) : (
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      Archived
                    </Text>
                  )}
                  {showOtherSection
                    ? visibleOther.map((property) => (
                        <PRGCard
                          key={property.id}
                          onPress={() => router.push(Routes.PROPERTIES.DETAIL(property.id))}
                          style={styles.otherCard}
                        >
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {propertyDisplayName(property)}
                          </Text>
                          <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                            {(property.status || 'draft').replace(/_/g, ' ')}
                          </Text>
                        </PRGCard>
                      ))
                    : null}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!finishDraft}
        transparent
        animationType="fade"
        onRequestClose={() => setFinishDraft(null)}
        accessibilityViewIsModal
      >
        <View style={[styles.promptBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFinishDraft(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View
            style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.promptTitle, { color: colors.text }]}>
              Ready to finish your inspection?
            </Text>
            <Text style={[styles.promptBody, { color: colors.textSecondary }]}>
              {finishDraft
                ? `Your ${getInspectionTypeLabel(finishDraft.inspection_type).toLowerCase()} draft is ${finishDraft.inspections_progress}% complete. Continue where you left off, or come back later.`
                : ''}
            </Text>
            <PRGButton
              title="Yes, continue"
              onPress={continueDraftInspection}
              style={styles.promptButton}
              accessibilityLabel="Continue unfinished inspection"
            />
            <PRGButton
              title="Not right now"
              onPress={() => setFinishDraft(null)}
              variant="secondary"
              style={styles.promptButton}
              accessibilityLabel="Keep draft and close"
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!tourPromptProperty}
        transparent
        animationType="fade"
        onRequestClose={() => setTourPromptProperty(null)}
        accessibilityViewIsModal
      >
        <View style={[styles.promptBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTourPromptProperty(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View
            style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.promptTitle, { color: colors.text }]}>
              {`Do you have a tour scheduled for ${tourPromptLabel}?`}
            </Text>
            <Text style={[styles.promptBody, { color: colors.textSecondary }]}>
              Add your scheduled time now to get a reminder!
            </Text>
            <PRGButton
              title="Add scheduled time"
              onPress={openTourSchedule}
              style={styles.promptButton}
              accessibilityLabel="Add scheduled tour time"
            />
            <PRGButton
              title="Not right now"
              onPress={() => setTourPromptProperty(null)}
              variant="secondary"
              style={styles.promptButton}
              accessibilityLabel="Skip scheduling for now"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

/** Desktop grid tile: dashed empty slot that starts property creation. */
function AddPropertyCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.addCard,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.backgroundTertiary : colors.backgroundSecondary,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add property"
      accessibilityHint="Creates a new property"
    >
      <Text style={[styles.addCardPlus, { color: colors.primary }]}>+</Text>
      <Text style={[styles.addCardTitle, { color: colors.text }]}>Add property</Text>
      <Text style={[styles.addCardHint, { color: colors.textSecondary }]}>
        Tour a place or add a rental
      </Text>
    </Pressable>
  );
}

function PropertyHubCard({
  property,
  statusLabel,
  stageLabel,
  stageVariant,
  stageDetail,
  primaryAction,
  secondaryAction,
  onOpen,
  compact = false,
}: {
  property: Property;
  /** Rents hub: plain status text (e.g. Active / Shared). */
  statusLabel?: string;
  /**
   * Tours hub: single combined stage badge
   * (Applied | Scheduled | Toured | Not scheduled).
   */
  stageLabel?: string;
  stageVariant?: 'success' | 'warning' | 'default';
  /** Optional datetime shown beside the Tours stage badge. */
  stageDetail?: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  onOpen: () => void;
  /** Tighter card for desktop grid cells. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.hubCard,
        compact && styles.hubCardCompact,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open property">
        <View style={styles.statusRow}>
          {stageLabel ? (
            <View style={styles.scheduleBadgeRow}>
              <PRGBadge
                label={stageLabel}
                variant={stageVariant ?? 'default'}
              />
              {stageDetail ? (
                <Text
                  style={[styles.tourScheduledAt, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {stageDetail}
                </Text>
              ) : null}
            </View>
          ) : statusLabel ? (
            <Text style={[styles.statusPill, { color: colors.primary }]}>{statusLabel}</Text>
          ) : null}
        </View>
        <Text style={[styles.hubTitle, compact && styles.hubTitleCompact, { color: colors.text }]}>
          {propertyDisplayName(property)}
        </Text>
        <Text style={[styles.hubAddress, { color: colors.textSecondary }]} numberOfLines={2}>
          {formatPropertyAddress(property)}
        </Text>
      </Pressable>
      {primaryAction ? (
        <PRGButton
          title={primaryAction.label}
          onPress={primaryAction.onPress}
          variant="primary"
          style={styles.hubPrimaryButton}
        />
      ) : null}
      {secondaryAction ? (
        <PRGButton
          title={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="secondary"
          disabled={secondaryAction.disabled}
          style={styles.hubSecondaryButton}
          accessibilityLabel={secondaryAction.label}
        />
      ) : null}
      <PRGButton title="Open property" onPress={onOpen} variant="ghost" />
    </View>
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
  searchInput: {
    marginBottom: spacing.md,
  },
  searchInputWithFilters: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 14,
  },
  hubIntro: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardGridItem: {
    // Fixed half-width cells so an odd last card never stretches into the empty slot.
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 280,
    width: Platform.OS === 'web' ? ('calc(50% - 8px)' as unknown as number) : '48%',
  },
  addCard: {
    flex: 1,
    minHeight: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  addCardPlus: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 40,
    marginBottom: spacing.xs,
  },
  addCardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  addCardHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  hubCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  hubCardCompact: {
    marginBottom: 0,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  scheduleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flexShrink: 1,
  },
  tourScheduledAt: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    flexShrink: 1,
  },
  statusPill: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hubTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  hubTitleCompact: {
    fontSize: typography.fontSize.xl,
  },
  hubAddress: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  hubPrimaryButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  hubSecondaryButton: {
    marginBottom: spacing.xs,
  },
  otherToggle: {
    marginBottom: spacing.sm,
  },
  otherCard: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textTransform: 'capitalize',
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
  promptBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  promptCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
    zIndex: 1,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
      default: { elevation: 8 },
    }),
  },
  promptTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  promptBody: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  promptButton: {
    marginTop: spacing.md,
  },
});
