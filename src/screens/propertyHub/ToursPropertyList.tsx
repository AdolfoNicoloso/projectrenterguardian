import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGEmptyState } from '../../components';
import { useDesktopLayout } from '../../hooks/useDesktopLayout';
import { Routes } from '../../navigation/routes';
import {
  isAppliedPropertyStatus,
  isTouringPropertyStatus,
} from '../../constants/propertyStatuses';
import { formatDisplayDate } from '../../utils/dateTime';
import { getToursHubStage, hasTourCompleted } from '../../utils/tourSchedule';
import type { Property } from '../../types';
import { AddPropertyCard } from './AddPropertyCard';
import { PropertyHubCard } from './PropertyHubCard';
import { propertyHubStyles as styles } from './propertyHubStyles';

type ToursPropertyListProps = {
  properties: Property[];
  incompleteTourByPropertyId: Record<string, string>;
  markingAppliedId: string | null;
  markingTouredId: string | null;
  hasSearchQuery: boolean;
  onMarkApplied: (property: Property) => void;
  onMarkToured: (property: Property) => void;
};

/**
 * Tours hub card grid (or empty state).
 */
export function ToursPropertyList({
  properties,
  incompleteTourByPropertyId,
  markingAppliedId,
  markingTouredId,
  hasSearchQuery,
  onMarkApplied,
  onMarkToured,
}: ToursPropertyListProps) {
  const router = useRouter();
  const isDesktop = useDesktopLayout();

  if (properties.length === 0) {
    if (hasSearchQuery) return null;
    return (
      <PRGEmptyState
        title="No tours yet"
        message="Add a place you’re considering, document what you see, then mark it toured when you’re done."
        actionLabel="Add touring property"
        onAction={() => router.push(Routes.PROPERTIES.CREATE)}
      />
    );
  }

  return (
    <View style={styles.section}>
      <View style={isDesktop ? styles.cardGrid : undefined}>
        {properties.map((property) => {
          const canEdit =
            !property.my_role ||
            property.my_role === 'owner' ||
            property.my_role === 'edit';
          const isTouring = isTouringPropertyStatus(property.status);
          const isApplied = isAppliedPropertyStatus(property.status);
          const toured = hasTourCompleted(property);
          const incompleteTourId = incompleteTourByPropertyId[property.id];
          const stage = getToursHubStage(property);

          let primaryAction:
            | { label: string; onPress: () => void }
            | undefined;
          let secondaryAction:
            | { label: string; onPress: () => void; disabled?: boolean }
            | undefined;

          if (canEdit && isApplied) {
            primaryAction = {
              label: 'Choose this place',
              onPress: () =>
                router.push(Routes.PROPERTIES.CONVERT(property.id)),
            };
            secondaryAction = incompleteTourId
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
                };
          } else if (canEdit) {
            primaryAction = incompleteTourId
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
                };
            if (isTouring && !toured) {
              secondaryAction = {
                label:
                  markingTouredId === property.id
                    ? 'Updating…'
                    : 'Mark as toured',
                onPress: () => onMarkToured(property),
                disabled: markingTouredId === property.id,
              };
            } else if (isTouring && toured) {
              secondaryAction = {
                label:
                  markingAppliedId === property.id
                    ? 'Updating…'
                    : 'Mark as Applied',
                onPress: () => onMarkApplied(property),
                disabled: markingAppliedId === property.id,
              };
            }
          }

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
                primaryAction={primaryAction}
                secondaryAction={secondaryAction}
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
  );
}
