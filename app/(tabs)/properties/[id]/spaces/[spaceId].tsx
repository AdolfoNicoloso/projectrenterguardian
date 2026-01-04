import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PRGCard, PRGEditableTextRow, PRGHeader, PRGPhotoGrid, PRGButton, PRGInput, useToast } from '../../../../../src/components';
import { spacesService } from '../../../../../src/services/spacesService';
import { propertiesService } from '../../../../../src/services/propertiesService';
import { photosService } from '../../../../../src/services/photosService';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';
import type { Space } from '../../../../../src/types';

const SPACE_TYPES: Array<{ value: Space['space_type']; label: string }> = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'dining_room', label: 'Dining Room' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'garage', label: 'Garage' },
  { value: 'custom_space_type', label: 'Custom' },
];

export default function SpaceDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isEditingSpaceType, setIsEditingSpaceType] = useState(false);
  const [selectedSpaceType, setSelectedSpaceType] = useState<Space['space_type'] | null>(null);
  const [otherTypeValue, setOtherTypeValue] = useState('');

  // Handle array params (Expo Router sometimes returns arrays)
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const spaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;

  const loadSpace = useCallback(async () => {
    if (!spaceId || !id) {
      setError('Missing property ID or space ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      console.log('[SpaceDetailScreen] Loading space:', { spaceId, propertyId: id });
      const spaces = await spacesService.getSpaces(id);
      console.log('[SpaceDetailScreen] Loaded spaces:', spaces.length, 'spaces');
      console.log('[SpaceDetailScreen] Looking for space ID:', spaceId, '(type:', typeof spaceId, ')');
      console.log('[SpaceDetailScreen] Available space IDs:', spaces.map(s => ({ id: s.id, type: typeof s.id, display_name: s.display_name })));
      
      // Normalize both IDs to strings for comparison (Directus may return numeric IDs)
      const normalizedSpaceId = String(spaceId);
      const foundSpace = spaces.find(s => String(s.id) === normalizedSpaceId);
      
      if (foundSpace) {
        console.log('[SpaceDetailScreen] Found space:', foundSpace.display_name);
        setSpace(foundSpace);
        setSelectedSpaceType(foundSpace.space_type);
        // If space_type is "custom", load the custom_type_name
        setOtherTypeValue(foundSpace.space_type === 'custom_space_type' ? (foundSpace.custom_space_type || '') : '');
      } else {
        console.warn('[SpaceDetailScreen] Space not found. Looking for:', normalizedSpaceId);
        console.warn('[SpaceDetailScreen] Available IDs:', spaces.map(s => String(s.id)));
        setError(`Space not found. Available spaces: ${spaces.length}`);
        setSpace(null);
      }
    } catch (error) {
      console.error('[SpaceDetailScreen] Error loading space:', error);
      setError(error instanceof Error ? error.message : 'Failed to load space');
      setSpace(null);
    } finally {
      setLoading(false);
    }
  }, [id, spaceId]);

  useEffect(() => {
    if (id && spaceId) {
      loadSpace();
    }
  }, [id, spaceId, loadSpace]);

  const loadProperty = useCallback(async () => {
      if (!id) return;
      try {
        const prop = await propertiesService.getProperty(id);
        setProperty(prop);
      } catch {
        setProperty(null);
      }
  }, [id]);

  const loadPhotos = useCallback(async () => {
    if (!id || !spaceId) return;
      try {
      // Load photos filtered by space directly from the backend
      const spacePhotos = await photosService.getPhotos(id, { spaceId });
      console.log('[SpaceDetailScreen] Loaded photos:', {
        forSpace: spacePhotos.length,
        spaceId,
        photos: spacePhotos.map(p => ({ id: p.id, file: p.file, space: p.space }))
      });
      setPhotos(spacePhotos);
    } catch (error) {
      console.error('[SpaceDetailScreen] Error loading photos:', error);
        setPhotos([]);
      }
  }, [id, spaceId]);

  useEffect(() => {
    if (id) {
      loadProperty();
    }
  }, [id, loadProperty]);

  // Reload photos when screen comes into focus (e.g., after uploading photos)
  useFocusEffect(
    useCallback(() => {
      if (id && spaceId) {
      loadPhotos();
    }
    }, [id, spaceId, loadPhotos])
  );

  const handleUpdateDisplayName = async (newName: string) => {
    if (!spaceId || !newName.trim()) return;
    try {
      await spacesService.updateSpace(spaceId, { display_name: newName.trim() });
      showToast('Space name updated', 'success');
      await loadSpace();
    } catch (error) {
      console.error('Error updating space:', error);
      showToast('Failed to update space name', 'error');
    }
  };

  const handleUpdateSpaceType = async () => {
    if (!spaceId || !selectedSpaceType) return;
    
    // Validate "custom_space_type" type has a value
    if (selectedSpaceType === 'custom_space_type' && !otherTypeValue.trim()) {
      showToast('Please enter a value for "Custom"', 'error');
      return;
    }

    // Validate max length for "custom_space_type" value
    if (selectedSpaceType === 'custom_space_type' && otherTypeValue.length > 255) {
      showToast('Custom type value must be 255 characters or less', 'error');
      return;
    }

    try {
      const updateData: { 
        space_type: Space['space_type']; 
        custom_space_type?: string;
      } = {
        space_type: selectedSpaceType,
      };
      
      // If "custom_space_type" is selected, store the custom type name separately
      // This allows display_name to be edited independently
      if (selectedSpaceType === 'custom_space_type' && otherTypeValue.trim()) {
        updateData.custom_space_type = otherTypeValue.trim();
      } else if (selectedSpaceType !== 'custom_space_type') {
        // Clear custom_space_type when switching away from custom
        updateData.custom_space_type = null;
      }

      await spacesService.updateSpace(spaceId, updateData);
      showToast('Space type updated', 'success');
      setIsEditingSpaceType(false);
      await loadSpace();
    } catch (error) {
      console.error('Error updating space type:', error);
      showToast('Failed to update space type', 'error');
    }
  };

  const handleCancelSpaceTypeEdit = () => {
    if (space) {
      setSelectedSpaceType(space.space_type);
    }
    setOtherTypeValue('');
    setIsEditingSpaceType(false);
  };

  const handleDelete = async () => {
    console.log('[SpaceDetailScreen] handleDelete called, spaceId:', spaceId, 'space:', space);
    if (!spaceId || !space) {
      console.warn('[SpaceDetailScreen] No spaceId or space available for deletion');
      return;
    }

    // First, ask if user wants to delete photos
    const shouldDeletePhotos = await new Promise<boolean>((resolve) => {
      if (photos.length === 0) {
        // No photos to delete, skip the prompt
        resolve(false);
        return;
      }

      if (Platform.OS === 'web') {
        const confirmed = (window as any).confirm(
          `Would you like to delete all ${photos.length} photo${photos.length > 1 ? 's' : ''} assigned to this space?`
        );
        resolve(confirmed);
      } else {
        Alert.alert(
          'Delete Photos?',
          `Would you like to delete all ${photos.length} photo${photos.length > 1 ? 's' : ''} assigned to this space?`,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Yes',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      }
    });

    // Delete photos if user confirmed
    if (shouldDeletePhotos && photos.length > 0) {
      try {
        console.log('[SpaceDetailScreen] Deleting', photos.length, 'photos');
        // Delete all photos in parallel
        await Promise.all(photos.map(photo => photosService.deletePhoto(photo.id)));
        console.log('[SpaceDetailScreen] All photos deleted successfully');
      } catch (error) {
        console.error('[SpaceDetailScreen] Error deleting photos:', error);
        showToast('Failed to delete some photos', 'error');
        // Continue with space deletion even if photo deletion fails
      }
    }

    // Delete the space
    try {
      console.log('[SpaceDetailScreen] Calling deleteSpace with spaceId:', spaceId);
      await spacesService.deleteSpace(spaceId);
      console.log('[SpaceDetailScreen] Space deleted successfully');
      showToast('Space deleted successfully', 'success');
      if (id) {
        router.replace(`/(tabs)/properties/${id}`);
      } else {
      router.back();
      }
    } catch (error) {
      console.error('[SpaceDetailScreen] Error deleting space:', error);
      showToast('Failed to delete space', 'error');
    }
  };

  const getSpaceTypeLabel = (type: Space['space_type'], customTypeName?: string) => {
    if (type === 'custom_space_type' && customTypeName) {
      return customTypeName; // Show the custom type name as the label
    }
    const spaceType = SPACE_TYPES.find(st => st.value === type);
    return spaceType ? spaceType.label : type.replace('_', ' ');
  };

  const handleBack = () => {
    // Use native back navigation for proper iOS backward animation
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navigate to property detail if we can't go back
      if (id) {
        router.push(`/(tabs)/properties/${id}`);
      } else {
        router.push('/(tabs)/properties');
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Space" showBack onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!space && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Space Not Found" showBack onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error || 'Space not found'}
          </Text>
          {spaceId && (
            <Text style={[styles.errorDetail, { color: colors.textTertiary }]}>
              Space ID: {spaceId}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title={space.display_name}
        subtitle={property?.nickname ? `${property.nickname} > ${space.display_name}` : undefined}
        showBack
        onBack={handleBack}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <PRGCard>
          <PRGEditableTextRow
            label="Space Name"
            value={space.display_name}
            onSave={handleUpdateDisplayName}
            placeholder="e.g., Master Bedroom"
            required
          />
        </PRGCard>

        <PRGCard>
          <View style={styles.spaceTypeContainer}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Space Type</Text>
            {!isEditingSpaceType ? (
                <TouchableOpacity
                onPress={() => {
                  setIsEditingSpaceType(true);
                  setSelectedSpaceType(space.space_type);
                  // If space_type is "custom_space_type", pre-fill the custom input with custom_space_type
                  if (space.space_type === 'custom_space_type') {
                    setOtherTypeValue(space.custom_space_type || '');
                  } else {
                    setOtherTypeValue('');
                  }
                }}
                style={styles.editableValue}
              >
                <View style={styles.valueRow}>
                  <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                    {getSpaceTypeLabel(space.space_type, space.custom_type_name)}
                  </Text>
                  <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.editContainer}>
                <View style={styles.spaceTypeOptions}>
                  {SPACE_TYPES.map((type) => (
                    <PRGButton
                      key={type.value}
                      title={type.label}
                      onPress={() => {
                        setSelectedSpaceType(type.value);
                        if (type.value !== 'custom_space_type') {
                          setOtherTypeValue('');
                        }
                      }}
                      variant={selectedSpaceType === type.value ? 'primary' : 'secondary'}
                      style={styles.spaceTypeButton}
                    />
                  ))}
        </View>
                {selectedSpaceType === 'custom_space_type' && (
                  <View style={styles.otherInputContainer}>
        <PRGInput
                      label="Custom Space Type"
                      value={otherTypeValue}
                      onChangeText={setOtherTypeValue}
                      placeholder="Enter custom space type (max 255 characters)"
                      maxLength={255}
          autoCapitalize="words"
        />
                  </View>
                )}
                <View style={styles.editActions}>
                  <PRGButton
                    title="Cancel"
                    onPress={handleCancelSpaceTypeEdit}
                    variant="ghost"
                    style={styles.actionButton}
                  />
                  <PRGButton
                    title="Save"
                    onPress={handleUpdateSpaceType}
                    variant="primary"
                    style={styles.actionButton}
                    disabled={!selectedSpaceType || (selectedSpaceType === 'custom_space_type' && !otherTypeValue.trim())}
                  />
                </View>
              </View>
            )}
          </View>
        </PRGCard>

        <View style={styles.photosSection}>
          <View style={styles.photosHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
        <PRGButton
              title="Add Photos"
              onPress={() => router.push(`/(tabs)/properties/${id}/spaces/${spaceId}/add-photos`)}
              variant="secondary"
            />
          </View>
          {photos.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No photos yet</Text>
            </View>
          ) : (
            <PRGPhotoGrid
              photos={photos}
              selectedIds={[]}
              onPhotoPress={(photo) => router.push(`/(tabs)/properties/${id}/photos/${photo.id}`)}
              onPhotoSelect={() => {}}
              showSelection={false}
            />
          )}
        </View>

        <View style={styles.deleteContainer}>
          <PRGButton
            title="Delete Space"
            onPress={() => {
              console.log('[SpaceDetailScreen] Delete button pressed, space:', space);
              if (!space) {
                console.warn('[SpaceDetailScreen] No space object available');
                return;
              }
              
              // Use window.confirm on web as Alert.alert may not work
              if (Platform.OS === 'web') {
                const confirmed = (window as any).confirm(
                  `Are you sure you want to delete "${space.display_name}"? This action cannot be undone.`
                );
                if (confirmed) {
                  console.log('[SpaceDetailScreen] Delete confirmed (web), calling handleDelete');
                  handleDelete();
                } else {
                  console.log('[SpaceDetailScreen] Delete cancelled (web)');
                }
              } else {
                Alert.alert(
                  'Delete Space',
                  `Are you sure you want to delete "${space.display_name}"? This action cannot be undone.`,
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                      onPress: () => console.log('[SpaceDetailScreen] Delete cancelled'),
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        console.log('[SpaceDetailScreen] Delete confirmed, calling handleDelete');
                        handleDelete();
                      },
                    },
                  ],
                  { cancelable: true }
                );
              }
            }}
            variant="ghost"
            textColor={colors.error}
            style={styles.deleteButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  errorDetail: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  valueFlex: {
    flex: 1,
    marginRight: spacing.sm,
  },
  photosSection: {
    marginTop: spacing.md,
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyPhotos: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
  },
  spaceTypeContainer: {
    width: '100%',
  },
  editableValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  editHint: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  editContainer: {
    marginTop: spacing.sm,
  },
  spaceTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spaceTypeButton: {
    marginBottom: spacing.sm,
  },
  otherInputContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    minWidth: 80,
  },
  deleteContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  deleteButton: {
    width: '100%',
  },
});


