import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGPhotoGrid, PRGEmptyState } from '../components';
import { photosService } from '../services/photosService';
import { colors, spacing, typography } from '../theme';
import type { Photo, Space } from '../types';

interface PropertyAssignmentsProps {
  propertyId: string;
}

export const PropertyAssignments: React.FC<PropertyAssignmentsProps> = ({ propertyId }) => {
  const router = useRouter();
  const [unassignedPhotos, setUnassignedPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    loadUnassignedPhotos();
  }, [propertyId]);

  const loadUnassignedPhotos = async () => {
    try {
      const data = await photosService.getPhotos(propertyId, { status: 'unassigned' });
      setUnassignedPhotos(data);
    } catch (error) {
      console.error('Error loading unassigned photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (photoId: string) => {
    if (selectedIds.includes(photoId)) {
      setSelectedIds(selectedIds.filter(id => id !== photoId));
    } else {
      setSelectedIds([...selectedIds, photoId]);
    }
  };

  const handleBulkAssign = () => {
    if (selectedIds.length === 0) return;
    router.push({
      pathname: `/(tabs)/properties/${propertyId}/assignments/bulk`,
      params: { photoIds: selectedIds.join(',') },
    });
  };

  if (loading && unassignedPhotos.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PRGButton
          title={selectionMode ? 'Cancel' : 'Select Photos'}
          onPress={() => {
            setSelectionMode(!selectionMode);
            if (selectionMode) setSelectedIds([]);
          }}
          variant={selectionMode ? 'ghost' : 'secondary'}
        />
        {selectionMode && selectedIds.length > 0 && (
          <PRGButton
            title={`Assign ${selectedIds.length} Photo${selectedIds.length > 1 ? 's' : ''}`}
            onPress={handleBulkAssign}
            variant="primary"
            style={styles.assignButton}
          />
        )}
      </View>

      {unassignedPhotos.length === 0 ? (
        <PRGEmptyState
          title="All Photos Assigned"
          message="All photos have been assigned to spaces"
        />
      ) : (
        <PRGPhotoGrid
          photos={unassignedPhotos}
          selectedIds={selectedIds}
          onPhotoPress={(photo) => {
            if (selectionMode) {
              handlePhotoSelect(photo.id);
            } else {
              router.push(`/(tabs)/properties/${propertyId}/photos/${photo.id}`);
            }
          }}
          onPhotoSelect={handlePhotoSelect}
          showSelection={selectionMode}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  assignButton: {
    marginLeft: spacing.sm,
  },
});


