import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGCard, PRGEmptyState } from '../../components';
import { useDesktopLayout } from '../../hooks/useDesktopLayout';
import { useTheme } from '../../theme/useTheme';
import { Routes } from '../../navigation/routes';
import { propertyDisplayName } from '../../constants/propertyStatuses';
import { isCheckInDue } from '../../utils/propertyJourney';
import type { Property } from '../../types';
import { AddPropertyCard } from './AddPropertyCard';
import { PropertyHubCard } from './PropertyHubCard';
import { propertyHubStyles as styles } from './propertyHubStyles';

type RentsPropertyListProps = {
  activeProperties: Property[];
  otherProperties: Property[];
  visibleOther: Property[];
  firstPropertyId: string | null;
  showFirstInspectionCTA: boolean;
  showOtherProperties: boolean;
  showOtherSection: boolean;
  hasSearchQuery: boolean;
  onToggleArchived: () => void;
};

/**
 * Rents hub active + archived sections (or empty states).
 */
export function RentsPropertyList({
  activeProperties,
  otherProperties,
  visibleOther,
  firstPropertyId,
  showFirstInspectionCTA,
  showOtherProperties,
  showOtherSection,
  hasSearchQuery,
  onToggleArchived,
}: RentsPropertyListProps) {
  const router = useRouter();
  const isDesktop = useDesktopLayout();
  const { colors } = useTheme();

  return (
    <>
      {activeProperties.length > 0 ? (
        <View style={styles.section}>
          <View style={isDesktop ? styles.cardGrid : undefined}>
            {activeProperties.map((property) => {
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
                                  '/onboarding/inspection-ready?propertyId=' +
                                    property.id
                                ),
                            }
                          : isCheckInDue(property)
                            ? {
                                label: 'Start check-in',
                                onPress: () =>
                                  router.push(
                                    `/(tabs)/inspections/new?propertyId=${encodeURIComponent(property.id)}&inspectionType=periodic`
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
                    onOpen={() =>
                      router.push(Routes.PROPERTIES.DETAIL(property.id))
                    }
                    compact={isDesktop}
                  />
                </View>
              );
            })}
            {isDesktop && !hasSearchQuery ? (
              <View style={styles.cardGridItem}>
                <AddPropertyCard
                  onPress={() => router.push(Routes.PROPERTIES.CREATE)}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : !hasSearchQuery && otherProperties.length === 0 ? (
        <PRGEmptyState
          title="No rentals yet"
          message="Add the place you’re renting, or convert a tour when you choose a place."
          actionLabel="Add rental"
          onAction={() => router.push(Routes.PROPERTIES.CREATE)}
        />
      ) : !hasSearchQuery && activeProperties.length === 0 ? (
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
                  : `Archived (${otherProperties.length})`
              }
              onPress={onToggleArchived}
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
                  onPress={() =>
                    router.push(Routes.PROPERTIES.DETAIL(property.id))
                  }
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
  );
}
