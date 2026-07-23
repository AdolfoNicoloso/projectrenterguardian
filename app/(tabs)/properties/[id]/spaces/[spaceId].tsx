import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PRGCard, PRGEditableTextRow, PRGHeader, PRGPhotoGrid, PRGButton, PRGInput, NotesListEditor, useToast } from '../../../../../src/components';
import { spacesService } from '../../../../../src/services/spacesService';
import { photosService } from '../../../../../src/services/photosService';
import { useAuthStore } from '../../../../../src/state/authStore';
import { usePropertiesStore } from '../../../../../src/state/propertiesStore';
import { SPACE_TYPES, getSpaceTypeLabel } from '../../../../../src/constants/spaceTypes';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';
import type { NoteEntry, Space } from '../../../../../src/types';
import { coerceNotesEntries } from '../../../../../src/utils/notes';
import { canEditProperty } from '../../../../../src/utils/propertyAccess';

export default function SpaceDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isEditingSpaceType, setIsEditingSpaceType] = useState(false);
  const [selectedSpaceType, setSelectedSpaceType] = useState<Space['space_type'] | null>(null);
  const [otherTypeValue, setOtherTypeValue] = useState('');
  const [notesEntries, setNotesEntries] = useState<NoteEntry[]>([]);

  const currentUserName =
    authUser?.displayName?.trim() ||
    authUser?.email?.trim() ||
    authUser?.phoneNumber?.trim() ||
    'You';

  // Handle array params (Expo Router sometimes returns arrays)
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const spaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;

  const loadSpace = useCallback(async (opts?: { soft?: boolean }) => {
    if (!spaceId || !id) {
      setError('Missing property ID or space ID');
      setLoading(false);
      return;
    }
    const soft = opts?.soft ?? false;
    try {
      if (!soft) {
        setLoading(true);
      }
      setError(null);
      const spaces = await spacesService.getSpaces(id);
      const normalizedSpaceId = String(spaceId);
      const foundSpace = spaces.find((s) => String(s.id) === normalizedSpaceId);

      if (foundSpace) {
        setSpace(foundSpace);
        setSelectedSpaceType(foundSpace.space_type);
        setNotesEntries(
          coerceNotesEntries(foundSpace.notes_entries, foundSpace.notes)
        );
        setOtherTypeValue(
          foundSpace.space_type === 'custom_space_type'
            ? foundSpace.custom_space_type || ''
            : ''
        );
      } else {
        setError(`Space not found. Available spaces: ${spaces.length}`);
        setSpace(null);
      }
    } catch (err) {
      console.error('[SpaceDetailScreen] Error loading space:', err);
      setError(err instanceof Error ? err.message : 'Failed to load space');
      setSpace(null);
    } finally {
      setLoading(false);
    }
  }, [id, spaceId]);

  const loadProperty = useCallback(async () => {
    if (!id) return;
    const cached = usePropertiesStore.getState().byId[id];
    if (cached) {
      setProperty(cached);
      return;
    }
    try {
      const prop = await usePropertiesStore.getState().fetchOne(id);
      setProperty(prop);
    } catch {
      setProperty(null);
    }
  }, [id]);

  const loadPhotos = useCallback(async () => {
    if (!id || !spaceId) return;
    try {
      const spacePhotos = await photosService.getPhotos(id, { spaceId });
      setPhotos(spacePhotos);
    } catch (error) {
      console.error('[SpaceDetailScreen] Error loading photos:', error);
      setPhotos([]);
    }
  }, [id, spaceId]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !spaceId) return;
      void loadSpace({ soft: true });
      void loadProperty();
      void loadPhotos();
    }, [id, spaceId, loadSpace, loadProperty, loadPhotos])
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

  const handlePersistNotes = async (entries: NoteEntry[]) => {
    if (!spaceId) return;
    try {
      const updated = await spacesService.updateSpace(spaceId, {
        notes_entries: entries,
      });
      setSpace(updated);
      setNotesEntries(
        coerceNotesEntries(updated.notes_entries, updated.notes)
      );
      showToast('Notes saved', 'success');
    } catch (error) {
      console.error('Error saving space notes:', error);
      showToast('Failed to save notes', 'error');
      throw error;
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
    if (!spaceId || !space) {
      return;
    }

    const photoCount = photos.length;
    const title = 'Delete this space?';
    const message =
      photoCount > 0
        ? `“${space.display_name}” will be removed. ${photoCount} photo${photoCount === 1 ? '' : 's'} will move to Unassigned — they will not be deleted.`
        : `“${space.display_name}” will be removed. This cannot be undone.`;

    const confirmed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }
      Alert.alert(title, message, [
        { text: 'Keep space', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete space', style: 'destructive', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });

    if (!confirmed) return;

    try {
      await spacesService.deleteSpace(spaceId);
      showToast(
        photoCount > 0
          ? `Space deleted. ${photoCount} photo${photoCount === 1 ? '' : 's'} moved to Unassigned.`
          : 'Space deleted',
        'success'
      );
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

  if (loading && !space) {
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

  const canEdit = canEditProperty(property);

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
            onSave={canEdit ? handleUpdateDisplayName : undefined}
            placeholder="e.g., Master Bedroom"
            required
          />
        </PRGCard>

        <PRGCard>
          <View style={styles.spaceTypeContainer}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Space Type</Text>
            {!isEditingSpaceType ? (
                <TouchableOpacity
                onPress={
                  canEdit
                    ? () => {
                        setIsEditingSpaceType(true);
                        setSelectedSpaceType(space.space_type);
                        // If space_type is "custom_space_type", pre-fill the custom input with custom_space_type
                        if (space.space_type === 'custom_space_type') {
                          setOtherTypeValue(space.custom_space_type || '');
                        } else {
                          setOtherTypeValue('');
                        }
                      }
                    : undefined
                }
                disabled={!canEdit}
                style={styles.editableValue}
              >
                <View style={styles.valueRow}>
                  <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                    {getSpaceTypeLabel(space.space_type, space.custom_space_type)}
                  </Text>
                  {canEdit ? (
                    <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
                  ) : null}
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

        <PRGCard>
          <NotesListEditor
            entries={notesEntries}
            onChange={setNotesEntries}
            onPersist={canEdit ? handlePersistNotes : undefined}
            editable={canEdit}
            currentUserName={currentUserName}
            placeholder="e.g., scuffed wall, missing cover plate…"
          />
        </PRGCard>

        <View style={styles.photosSection}>
          <View style={styles.photosHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
            {canEdit ? (
              <PRGButton
                title="Add Photos"
                onPress={() => router.push(`/(tabs)/properties/${id}/spaces/${spaceId}/add-photos`)}
                variant="secondary"
              />
            ) : null}
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

        {canEdit ? (
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
        ) : null}
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


