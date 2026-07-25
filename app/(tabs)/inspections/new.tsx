import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGHeader, PRGButton, PRGLoadingOverlay, useToast } from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { inspectionsService } from '../../../src/services/inspectionsService';
import {
  INSPECTION_TYPES,
  getInspectionTypeShortDescription,
  isValidInspectionType,
} from '../../../src/constants/inspectionTypes';
import {
  canPropertyStartInspectionType,
  isActivePropertyStatus,
  isToursHubPropertyStatus,
  propertyDisplayName,
} from '../../../src/constants/propertyStatuses';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Property } from '../../../src/types';

export default function NewInspectionStartScreen() {
  const router = useRouter();
  const { propertyId, inspectionType, spaceWalk } = useLocalSearchParams<{
    propertyId?: string;
    inspectionType?: string;
    spaceWalk?: string;
  }>();
  const resolvedSpaceWalk =
    spaceWalk === 'existing' || spaceWalk === 'pick' ? spaceWalk : undefined;
  const { colors } = useTheme();
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedInspectionType, setSelectedInspectionType] = useState<string>(
    typeof inspectionType === 'string' && isValidInspectionType(inspectionType)
      ? inspectionType
      : 'tour'
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [autoStarting, setAutoStarting] = useState(
    Boolean(propertyId && inspectionType && isValidInspectionType(inspectionType))
  );
  const [inactiveDeepLink, setInactiveDeepLink] = useState(false);
  const { showToast } = useToast();

  const eligibleProperties = useMemo(
    () =>
      allProperties.filter((p) =>
        canPropertyStartInspectionType(p.status, selectedInspectionType)
      ),
    [allProperties, selectedInspectionType]
  );

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (!autoStarting || loading || creating) return;
    if (!propertyId || !inspectionType || !isValidInspectionType(inspectionType)) {
      setAutoStarting(false);
      return;
    }
    const match = allProperties.find((p) => p.id === propertyId);
    if (!match) {
      setAutoStarting(false);
      return;
    }
    if (!canPropertyStartInspectionType(match.status, inspectionType)) {
      setInactiveDeepLink(true);
      setAutoStarting(false);
      setSelectedPropertyId(null);
      showToast(
        inspectionType === 'tour'
          ? 'Set this property to Touring or Active to start a Tour'
          : 'Only active properties can start that inspection',
        'error'
      );
      return;
    }
    void startInspection(propertyId, inspectionType, resolvedSpaceWalk);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto start
  }, [autoStarting, loading, allProperties, propertyId, inspectionType]);

  useEffect(() => {
    if (
      selectedPropertyId &&
      !eligibleProperties.some((p) => p.id === selectedPropertyId)
    ) {
      setSelectedPropertyId(null);
    }
  }, [eligibleProperties, selectedPropertyId]);

  const loadProperties = async () => {
    try {
      const data = await propertiesService.getMyProperties();
      const eligiblePool = data.filter(
        (p) => isActivePropertyStatus(p.status) || isToursHubPropertyStatus(p.status)
      );
      setAllProperties(eligiblePool);

      if (propertyId) {
        const match = data.find((p) => p.id === propertyId);
        const type =
          typeof inspectionType === 'string' && isValidInspectionType(inspectionType)
            ? inspectionType
            : selectedInspectionType;
        if (match && canPropertyStartInspectionType(match.status, type)) {
          setSelectedPropertyId(propertyId);
        } else if (match) {
          setInactiveDeepLink(true);
        }
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      showToast('Failed to load properties', 'error');
      setAutoStarting(false);
    } finally {
      setLoading(false);
    }
  };

  const startInspection = async (
    propId: string,
    type: string,
    walkMode?: 'existing' | 'pick'
  ) => {
    setCreating(true);
    try {
      const inspection = await inspectionsService.createInspection({
        property_id: propId,
        inspection_type: type,
      });

      if (walkMode) {
        try {
          const step = await inspectionsService.getInspectionStep(
            inspection.id,
            'capture_spaces'
          );
          await inspectionsService.updateInspectionStep(step.id, {
            payload_json: {
              ...(typeof step.payload_json === 'object' && step.payload_json
                ? step.payload_json
                : {}),
              space_walk: walkMode,
            },
          });
        } catch (patchErr) {
          console.warn('Could not set space_walk on capture_spaces:', patchErr);
        }
      }

      router.replace(`/(tabs)/inspections/${inspection.id}`);
    } catch (error: any) {
      console.error('Error creating inspection:', error);
      showToast(error?.message || 'Failed to create inspection', 'error');
      setCreating(false);
      setAutoStarting(false);
    }
  };

  const handleStart = async () => {
    if (!selectedPropertyId) {
      showToast('Please select a property', 'error');
      return;
    }
    if (!selectedInspectionType) {
      showToast('Please select an inspection type', 'error');
      return;
    }
    await startInspection(selectedPropertyId, selectedInspectionType, resolvedSpaceWalk);
  };

  if (loading || autoStarting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="New Inspection" showBack={!autoStarting} />
        <View style={styles.loadingContainer} accessibilityLabel="Preparing inspection">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {autoStarting ? 'Starting your guided inspection…' : 'Loading…'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="New Inspection" showBack />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Choose a property and type. Active properties can start any inspection. Touring properties
          can start a Tour. Draft and archived residences are not eligible.
        </Text>

        {inactiveDeepLink ? (
          <Text style={[styles.warning, { color: colors.warning }]}>
            That property is not eligible for this inspection type. Set it to Active (or Touring for
            a Tour) on the property overview, then try again.
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Property</Text>
        {eligibleProperties.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {selectedInspectionType === 'tour'
              ? 'No Touring or Active properties yet. Set a property to Touring or Active to start a Tour.'
              : 'No active properties yet. Set a property’s status to Active to start this inspection.'}
          </Text>
        ) : (
          eligibleProperties.map((property) => (
            <PRGButton
              key={property.id}
              title={propertyDisplayName(property)}
              onPress={() => setSelectedPropertyId(property.id)}
              variant={selectedPropertyId === property.id ? 'primary' : 'secondary'}
              style={styles.propertyButton}
              accessibilityLabel={`Select property ${propertyDisplayName(property)}`}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Inspection type</Text>
        {INSPECTION_TYPES.map((type) => {
          const selected = selectedInspectionType === type.value;
          return (
            <View key={type.value} style={styles.typeBlock}>
              <PRGButton
                title={type.label}
                onPress={() => setSelectedInspectionType(type.value)}
                variant={selected ? 'primary' : 'secondary'}
                style={styles.typeButton}
                accessibilityLabel={`Select ${type.label} inspection`}
                accessibilityHint={type.shortDescription}
              />
              {selected ? (
                <Text style={[styles.typeHint, { color: colors.textSecondary }]}>
                  {getInspectionTypeShortDescription(type.value)}
                </Text>
              ) : null}
            </View>
          );
        })}

        <PRGButton
          title={selectedInspectionType === 'tour' ? 'Start Tour' : 'Start Inspection'}
          onPress={handleStart}
          variant="primary"
          disabled={!selectedPropertyId || !selectedInspectionType || eligibleProperties.length === 0}
          loading={creating}
          style={styles.startButton}
          accessibilityLabel={
            selectedInspectionType === 'tour' ? 'Start tour' : 'Start inspection'
          }
        />
      </ScrollView>
      {creating ? <PRGLoadingOverlay visible message="Creating…" /> : null}
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
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  intro: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  warning: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  empty: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  propertyButton: {
    marginBottom: spacing.sm,
  },
  typeBlock: {
    marginBottom: spacing.sm,
  },
  typeButton: {
    marginBottom: 0,
  },
  typeHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  startButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
});
