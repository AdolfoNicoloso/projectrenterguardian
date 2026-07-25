import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PRGCard,
  PRGImageLightbox,
  NotesListEditor,
  openImageWithNativeZoom,
  useToast,
} from '../../../../../src/components';
import { photosService } from '../../../../../src/services/photosService';
import { spacesService } from '../../../../../src/services/spacesService';
import { useAuthStore } from '../../../../../src/state/authStore';
import { usePropertiesStore } from '../../../../../src/state/propertiesStore';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';
import type { NoteEntry, Photo, Space } from '../../../../../src/types';
import { getAuthenticatedMediaFileUrl, getMediaFilePlaceholderUrl } from '../../../../../src/utils/fileUrl';
import { formatDisplayDate } from '../../../../../src/utils/dateTime';
import { coerceNotesEntries } from '../../../../../src/utils/notes';
import { goBackOr } from '../../../../../src/navigation/goBackOr';
import { Routes } from '../../../../../src/navigation/routes';

export default function PhotoDetailScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [notesEntries, setNotesEntries] = useState<NoteEntry[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentUserName =
    authUser?.displayName?.trim() ||
    authUser?.email?.trim() ||
    authUser?.phoneNumber?.trim() ||
    'You';

  useEffect(() => {
    if (photo?.file) {
      getAuthenticatedMediaFileUrl(photo.file, 'display')
        .then(setImageUri)
        .catch((error) => {
          console.error('Error getting file URL:', error);
          setImageUri(getMediaFilePlaceholderUrl(photo.file));
        });
    } else {
      setImageUri(null);
    }
  }, [photo?.file]);

  const loadData = useCallback(async (opts?: { soft?: boolean }) => {
    if (!photoId || !id) return;
    const soft = opts?.soft ?? false;
    try {
      if (!soft) {
        setLoading(true);
      }
      const cachedProperty = usePropertiesStore.getState().byId[id];
      const [photoData, spacesData, propertyData] = await Promise.all([
        photosService.getPhoto(photoId).catch(() => null),
        spacesService.getSpaces(id),
        cachedProperty
          ? Promise.resolve(cachedProperty)
          : usePropertiesStore.getState().fetchOne(id).catch(() => null),
      ]);

      if (photoData) {
        setPhoto(photoData);
        setNotesEntries(
          coerceNotesEntries(photoData.notes_entries, photoData.notes)
        );
        setSelectedSpace(photoData.space || '');
      }

      setSpaces(spacesData);
      if (propertyData) {
        setProperty(propertyData);
      } else if (cachedProperty) {
        setProperty(cachedProperty);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [photoId, id]);

  useFocusEffect(
    useCallback(() => {
      if (photoId && id) {
        void loadData({ soft: true });
      }
    }, [photoId, id, loadData])
  );

  const handleBack = () => {
    goBackOr(
      router,
      id ? Routes.PROPERTIES.DETAIL(id) : Routes.RENTS.LIST
    );
  };

  const handleSave = async () => {
    if (!photoId || !photo) return;
    try {
      // Update notes and space directly on the photo
      const updates: {
        notes_entries?: NoteEntry[];
        space?: string | null;
        assignment_status?: string;
      } = {
        notes_entries: notesEntries,
      };

      // Update space assignment
      if (selectedSpace) {
        updates.space = selectedSpace;
        updates.assignment_status = 'confirmed';
      } else {
        // If unassigning, set space to null and mark as unassigned
        updates.space = null; // Explicitly set to null to clear the space field
        updates.assignment_status = 'unassigned';
      }

      await photosService.updatePhoto(photoId, updates);

      showToast('Photo updated', 'success');
      handleBack();
    } catch (error) {
      console.error('Error saving:', error);
      showToast('Failed to update photo', 'error');
    }
  };

  const handleDelete = async () => {
    if (!photoId) return;
    try {
      setDeleting(true);
      await photosService.deletePhoto(photoId);
      showToast('Photo deleted', 'success');
      handleBack();
    } catch (error) {
      console.error('Error deleting photo:', error);
      showToast('Failed to delete photo', 'error');
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    // Use window.confirm on web as Alert.alert may not work
    if (Platform.OS === 'web') {
      const confirmed = (window as any).confirm(
        'Are you sure you want to delete this photo? This action cannot be undone.'
      );
      if (confirmed) {
        handleDelete();
      }
    } else {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: handleDelete,
          },
        ]
      );
    }
  };

  if (loading && !photo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Photo" showBack onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Photo Not Found" showBack onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Photo not found</Text>
        </View>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    return formatDisplayDate(dateString, 'datetime') || 'N/A';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="Photo Details"
        subtitle={property?.nickname ? property.nickname : undefined}
        showBack
        onBack={handleBack}
        rightAction={{
          label: 'Save',
          onPress: handleSave,
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {imageUri ? (
        <Pressable
          onPress={() => {
            if (openImageWithNativeZoom(imageUri)) return;
            setLightboxOpen(true);
          }}
          accessibilityRole="imagebutton"
          accessibilityLabel="Open photo to zoom"
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => {
              if (imageUri && imageUri.includes('getFile') && photo?.file) {
                getAuthenticatedMediaFileUrl(photo.file, 'display')
                  .then((newUrl) => {
                    if (newUrl !== imageUri) {
                      setImageUri(newUrl);
                    }
                  })
                  .catch(() => {});
              }
            }}
          />
          <Text style={[styles.zoomHint, { color: colors.textTertiary }]}>
            Tap to open and zoom
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.image, { backgroundColor: colors.backgroundTertiary, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: colors.text }}>Loading image...</Text>
        </View>
      )}

        <PRGCard>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Captured At</Text>
        <Text style={[styles.value, { color: colors.text }]}>{formatDate(photo.captured_at)}</Text>
        <Text style={[styles.note, { color: colors.textTertiary }]}>This timestamp is read-only and cannot be changed</Text>
        </PRGCard>

        {spaces.length > 0 && (
          <PRGCard>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Assigned Space</Text>
        <View style={styles.spaceSelector}>
              <PRGButton
                title="Unassigned"
                onPress={() => setSelectedSpace('')}
                variant={selectedSpace === '' ? 'primary' : 'secondary'}
                style={styles.spaceButton}
              />
          {spaces.map((space) => (
            <PRGButton
              key={space.id}
              title={space.display_name}
              onPress={() => setSelectedSpace(space.id)}
              variant={selectedSpace === space.id ? 'primary' : 'secondary'}
              style={styles.spaceButton}
            />
          ))}
        </View>
          </PRGCard>
        )}

        <PRGCard>
          <NotesListEditor
            entries={notesEntries}
            onChange={setNotesEntries}
            currentUserName={currentUserName}
            placeholder="e.g., scuff on baseboard, strong odor…"
          />
        </PRGCard>

        <View style={styles.deleteContainer}>
          <PRGButton
            title="Delete Photo"
            onPress={confirmDelete}
            variant="ghost"
            loading={deleting}
            disabled={deleting}
            textColor={colors.error}
            style={styles.deleteButton}
          />
        </View>
      </ScrollView>

      <PRGImageLightbox
        visible={lightboxOpen}
        uri={imageUri}
        onClose={() => setLightboxOpen(false)}
      />
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
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  zoomHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  note: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  deleteContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  deleteButton: {
    width: '100%',
  },
  spaceSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
});
