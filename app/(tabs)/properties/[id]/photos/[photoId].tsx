import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PRGInput, PRGButton, PRGHeader, PRGCard, useToast } from '../../../../../src/components';
import { photosService } from '../../../../../src/services/photosService';
import { spacesService } from '../../../../../src/services/spacesService';
import { propertiesService } from '../../../../../src/services/propertiesService';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';
import type { Photo, Space } from '../../../../../src/types';
import { getDirectusFileUrlWithAuth } from '../../../../../src/utils/fileUrl';
import { formatDisplayDate } from '../../../../../src/utils/directusDate';

export default function PhotoDetailScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [photoId, id]);

  // Refetch photo data when screen comes into focus (e.g., after editing photo details)
  useFocusEffect(
    useCallback(() => {
      if (photoId && id) {
        loadData();
      }
    }, [photoId, id])
  );

  useEffect(() => {
    if (photo?.file) {
      getDirectusFileUrlWithAuth(photo.file)
        .then(setImageUri)
        .catch((error) => {
          console.error('Error getting file URL:', error);
          // Fallback
          const { getDirectusFileUrlSync } = require('../../../../../src/utils/fileUrl');
          setImageUri(getDirectusFileUrlSync(photo.file));
        });
    } else {
      setImageUri(null);
    }
  }, [photo?.file]);

  const loadData = async () => {
    if (!photoId || !id) return;
    try {
      setLoading(true);
      const [photoData, spacesData, propertyData] = await Promise.all([
        photosService.getPhoto(photoId).catch(() => null),
        spacesService.getSpaces(id),
        propertiesService.getProperty(id).catch(() => null),
      ]);
      
      if (photoData) {
        setPhoto(photoData);
        setNotes(photoData.notes || '');
        // Use photo.space field directly
        setSelectedSpace(photoData.space || '');
      }
      
      setSpaces(spacesData);
      setProperty(propertyData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Use native back navigation for proper iOS animation
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: go to properties list if we can't go back
      router.push('/(tabs)/properties');
    }
  };

  const handleSave = async () => {
    if (!photoId || !photo) return;
    try {
      // Update notes and space directly on the photo
      const updates: { notes?: string; space?: string | null; assignment_status?: string } = {
        notes: notes,
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Photo" showBack />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Photo Not Found" showBack />
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
      <Image
          source={{ 
            uri: imageUri,
            cache: 'force-cache'
          }}
        style={styles.image}
        resizeMode="contain"
          onError={(error) => {
            const errorDetails = error?.nativeEvent?.error || 'Unknown error';
            const errorMessage = typeof errorDetails === 'string' ? errorDetails : String(errorDetails);
            
            // Check if it's a decoding error (corrupted/unsupported format)
            if (errorMessage.includes('decoding') || errorMessage.includes('decode')) {
              console.warn(`[PhotoDetail] Image decode error: ${errorMessage}`);
              // Don't try to reload - decoding errors mean the file itself is the problem
              return;
            }
            
            // For network errors, try to reload
            if (errorMessage.includes('Failed to load resource') || errorMessage.includes('Network')) {
              console.warn('[PhotoDetail] Network error, attempting reload...');
              if (imageUri && imageUri.includes('getFile')) {
                getDirectusFileUrlWithAuth(photo.file)
                  .then((newUrl) => {
                    if (newUrl !== imageUri) {
                      setImageUri(newUrl);
                    }
                  })
                  .catch(() => {
                    // Silently fail
                  });
              }
            }
          }}
          onLoad={() => {
            console.log('[PhotoDetail] Image loaded successfully');
          }}
        />
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
        <PRGInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes about this photo..."
          multiline
          numberOfLines={4}
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
