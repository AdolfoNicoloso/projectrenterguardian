import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGHeader, PRGButton, PRGInput, PRGLoadingOverlay, useToast } from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { colors, spacing, typography } from '../../../src/theme';
import type { Property } from '../../../src/types';

const INSPECTION_TYPES = [
  'move_in',
  'move_out',
  'periodic',
  'damage_assessment',
];

export default function NewInspectionStartScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    propertyId || null
  );
  const [selectedInspectionType, setSelectedInspectionType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await propertiesService.getMyProperties();
      setProperties(data);
      if (propertyId && data.find((p) => p.id === propertyId)) {
        setSelectedPropertyId(propertyId);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      showToast('Failed to load properties', 'error');
    } finally {
      setLoading(false);
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

    setCreating(true);
    try {
      const inspection = await inspectionsService.createInspection({
        property_id: selectedPropertyId,
        inspection_type: selectedInspectionType,
      });
      // Navigate to the inspection wizard
      router.replace(`/(tabs)/inspections/${inspection.id}`);
    } catch (error) {
      console.error('Error creating inspection:', error);
      showToast('Failed to create inspection', 'error');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PRGHeader title="New Inspection" showBack />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PRGHeader title="New Inspection" showBack />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Select Property</Text>
        {properties.map((property) => (
          <PRGButton
            key={property.id}
            title={property.nickname || property.address_free_text}
            onPress={() => setSelectedPropertyId(property.id)}
            variant={selectedPropertyId === property.id ? 'primary' : 'secondary'}
            style={styles.propertyButton}
          />
        ))}

        <Text style={styles.sectionTitle}>Inspection Type</Text>
        {INSPECTION_TYPES.map((type) => (
          <PRGButton
            key={type}
            title={type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            onPress={() => setSelectedInspectionType(type)}
            variant={selectedInspectionType === type ? 'primary' : 'secondary'}
            style={styles.typeButton}
          />
        ))}

        <PRGButton
          title="Start Inspection"
          onPress={handleStart}
          variant="primary"
          disabled={!selectedPropertyId || !selectedInspectionType}
          loading={creating}
          style={styles.startButton}
        />
      </ScrollView>
      {creating && <PRGLoadingOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  propertyButton: {
    marginBottom: spacing.sm,
  },
  typeButton: {
    marginBottom: spacing.sm,
  },
  startButton: {
    marginTop: spacing.xl,
  },
});

