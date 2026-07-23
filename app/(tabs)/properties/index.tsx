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
} from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { useAuthStore } from '../../../src/state/authStore';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { usePropertiesList } from '../../../src/hooks/usePropertiesQuery';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Inspection, Property } from '../../../src/types';
import { Routes } from '../../../src/navigation/routes';
import { getInspectionTypeLabel } from '../../../src/constants/inspectionTypes';
import {
  isActivePropertyStatus,
  isTouringPropertyStatus,
  propertyDisplayName,
} from '../../../src/constants/propertyStatuses';
import { formatDisplayDate } from '../../../src/utils/cmsDateTime';
import {
  getTourScheduleBucket,
  hasTourScheduledAt,
  sortTouringProperties,
} from '../../../src/utils/tourSchedule';

/** Device-local throttle for the Home “tour scheduled?” boot modal. */
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

type HomeView = 'rentals' | 'tours';

function HomeSegmentControl({
  value,
  onChange,
}: {
  value: HomeView;
  onChange: (next: HomeView) => void;
}) {
  const { colors } = useTheme();
  const options: Array<{ value: HomeView; label: string }> = [
    { value: 'rentals', label: 'Rentals' },
    { value: 'tours', label: 'Tours' },
  ];

  return (
    <View
      style={[
        styles.segmentTrack,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentItem,
              selected && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: selected ? colors.text : colors.textSecondary,
                  fontWeight: selected
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.regular,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PropertiesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const {
    data: properties,
    isInitialLoading,
    isRefreshing,
    error,
    revalidate,
  } = usePropertiesList();
  const [homeView, setHomeView] = useState<HomeView>('rentals');
  const [searchQuery, setSearchQuery] = useState('');
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
  const didSetInitialView = useRef(false);

  const listIdsKey = useMemo(
    () => properties.map((p) => `${p.id}:${p.status ?? ''}`).join('|'),
    [properties]
  );

  const { active, touring, other } = useMemo(() => {
    const nextActive: Property[] = [];
    const nextTouring: Property[] = [];
    const nextOther: Property[] = [];
    for (const property of properties) {
      if (isActivePropertyStatus(property.status)) nextActive.push(property);
      else if (isTouringPropertyStatus(property.status)) nextTouring.push(property);
      else nextOther.push(property);
    }

    // Upcoming → toured → not scheduled.
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
    if (!q) {
      return { active, touring, other };
    }
    return {
      active: active.filter((p) => propertyMatchesSearch(p, q)),
      touring: touring.filter((p) => propertyMatchesSearch(p, q)),
      other: other.filter((p) => propertyMatchesSearch(p, q)),
    };
  }, [active, touring, other, searchQuery]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasVisibleInView =
    homeView === 'tours'
      ? visibleTouring.length > 0
      : visibleActive.length > 0 || visibleOther.length > 0;
  const showOtherSection = showOtherProperties || (hasSearchQuery && visibleOther.length > 0);

  // First load: land on Tours if the user only has touring properties.
  useEffect(() => {
    if (didSetInitialView.current || isInitialLoading || properties.length === 0) {
      return;
    }
    didSetInitialView.current = true;
    if (touring.length > 0 && active.length === 0) {
      setHomeView('tours');
    }
  }, [isInitialLoading, properties.length, touring.length, active.length]);

  const headerRightActions = useMemo(() => {
    const actions: Array<{
      label?: string;
      icon?: React.ReactNode;
      onPress: () => void;
      accessibilityLabel?: string;
    }> = [];
    if (homeView === 'tours') {
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
  }, [homeView, colors.primary, router]);

  const touringIdsKey = useMemo(
    () => touring.map((p) => p.id).join('|'),
    [touring]
  );

  const loadIncompleteTours = useCallback(async () => {
    if (!isAuthenticated || authLoading || touring.length === 0) {
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
  }, [authLoading, isAuthenticated, touring]);

  useFocusEffect(
    useCallback(() => {
      void loadIncompleteTours();
    }, [loadIncompleteTours])
  );

  useEffect(() => {
    void loadIncompleteTours();
  }, [loadIncompleteTours, touringIdsKey]);

  // Move-In CTA: Active property with no inspections yet.
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

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
  }, [listIdsKey, isAuthenticated, authLoading]);

  // Once per boot: unfinished draft, else Touring property prompt.
  useEffect(() => {
    if (authLoading || !isAuthenticated || bootPromptsShown.current) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [drafts, props] = await Promise.all([
          inspectionsService.getMyInspections({ status: 'in_progress' }),
          usePropertiesStore.getState().fetchList({ force: false }),
        ]);
        if (cancelled) return;
        bootPromptsShown.current = true;

        if (drafts.length > 0) {
          const sorted = [...drafts].sort((a, b) => {
            const aTime = Date.parse(a.date_updated || a.started_at || '') || 0;
            const bTime = Date.parse(b.date_updated || b.started_at || '') || 0;
            return bTime - aTime;
          });
          setFinishDraft(sorted[0]);
          return;
        }

        // Prompt only for Touring properties that still need a scheduled time.
        // Throttled to at most once per hour per device (skip entirely when cool-down active).
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
      } catch (err) {
        console.error('Error checking boot prompts:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

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

  const tourPromptLabel = tourPromptProperty
    ? tourPromptProperty.nickname?.trim() ||
      tourPromptProperty.street?.trim() ||
      tourPromptProperty.address_free_text?.trim() ||
      'this property'
    : 'this property';

  if (authLoading || (isInitialLoading && properties.length === 0)) {
    return (
      <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
        <PRGHeader
          title="Home"
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
        title="Home"
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
          title="Add your first property"
          message="Tour places you’re considering, or add the rental you already have. You can document room by room when you’re ready."
          actionLabel="Add Property"
          onAction={() => router.push(Routes.PROPERTIES.CREATE)}
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
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
                void loadIncompleteTours();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <HomeSegmentControl
            value={homeView}
            onChange={(next) => {
              setHomeView(next);
              setSearchQuery('');
            }}
          />

          <PRGInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              homeView === 'tours'
                ? 'Search tours by nickname or address'
                : 'Search rentals by nickname or address'
            }
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search properties by nickname or address"
            containerStyle={styles.searchInput}
          />

          {hasSearchQuery && !hasVisibleInView ? (
            <View style={styles.section}>
              <Text style={[styles.hubIntro, { color: colors.textSecondary }]}>
                No {homeView === 'tours' ? 'tours' : 'rentals'} match “
                {searchQuery.trim()}”.
              </Text>
            </View>
          ) : null}

          {homeView === 'tours' ? (
            <>
              {visibleTouring.length > 0 ? (
                <View style={styles.section}>
                  {visibleTouring.map((property) => {
                    const canEdit =
                      !property.my_role ||
                      property.my_role === 'owner' ||
                      property.my_role === 'edit';
                    const incompleteTourId = incompleteTourByPropertyId[property.id];
                    const scheduleBucket = getTourScheduleBucket(property);
                    const tourScheduleLabel =
                      scheduleBucket === 'upcoming'
                        ? 'Scheduled'
                        : scheduleBucket === 'toured'
                          ? 'Toured'
                          : 'Not Scheduled';
                    const tourScheduleVariant =
                      scheduleBucket === 'upcoming'
                        ? 'success'
                        : scheduleBucket === 'toured'
                          ? 'default'
                          : 'warning';
                    return (
                      <PropertyHubCard
                        key={property.id}
                        property={property}
                        statusLabel="Touring"
                        tourScheduleLabel={tourScheduleLabel}
                        tourScheduleVariant={tourScheduleVariant}
                        tourScheduledAtLabel={
                          scheduleBucket === 'upcoming' || scheduleBucket === 'toured'
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
                        onOpen={() => router.push(Routes.PROPERTIES.DETAIL(property.id))}
                      />
                    );
                  })}
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
                  {visibleActive.map((property) => {
                    const canEdit =
                      !property.my_role ||
                      property.my_role === 'owner' ||
                      property.my_role === 'edit';
                    return (
                      <PropertyHubCard
                        key={property.id}
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
                      />
                    );
                  })}
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
                          ? 'Hide draft & archived'
                          : `Draft & archived (${other.length})`
                      }
                      onPress={() => setShowOtherProperties((v) => !v)}
                      variant="ghost"
                      style={styles.otherToggle}
                    />
                  ) : (
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      Draft & archived
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

function PropertyHubCard({
  property,
  statusLabel,
  tourScheduleLabel,
  tourScheduleVariant,
  tourScheduledAtLabel,
  primaryAction,
  onOpen,
}: {
  property: Property;
  statusLabel: string;
  tourScheduleLabel?: string;
  tourScheduleVariant?: 'success' | 'warning' | 'default';
  /** Formatted tour date/time shown beside the Scheduled badge. */
  tourScheduledAtLabel?: string;
  primaryAction?: { label: string; onPress: () => void };
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.hubCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open property">
        <View style={styles.statusRow}>
          <Text style={[styles.statusPill, { color: colors.primary }]}>{statusLabel}</Text>
          {tourScheduleLabel ? (
            <View style={styles.scheduleBadgeRow}>
              <PRGBadge
                label={tourScheduleLabel}
                variant={tourScheduleVariant ?? 'default'}
              />
              {tourScheduledAtLabel ? (
                <Text
                  style={[styles.tourScheduledAt, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {tourScheduledAtLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Text style={[styles.hubTitle, { color: colors.text }]}>
          {propertyDisplayName(property)}
        </Text>
        {property.nickname ? (
          <Text style={[styles.hubAddress, { color: colors.textSecondary }]}>
            {property.address_free_text}
          </Text>
        ) : null}
      </Pressable>
      {primaryAction ? (
        <PRGButton
          title={primaryAction.label}
          onPress={primaryAction.onPress}
          variant="primary"
          style={styles.hubPrimaryButton}
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
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.md,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 40,
  },
  segmentLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
  },
  searchInput: {
    marginBottom: spacing.md,
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
  hubAddress: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  hubPrimaryButton: {
    marginTop: spacing.sm,
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
