import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PRGLoadingOverlay, PRGHeader, useToast } from '../../../../../src/components';
import {
  formatBatchUploadToast,
  pickMediaFromLibraryAsync,
  uploadImagePickerAssetsBatch,
} from '../../../../../src/services/mediaBatchUpload';
import { usePropertiesStore } from '../../../../../src/state/propertiesStore';
import { capturedAtFromExif } from '../../../../../src/utils/cmsDateTime';
import { canEditProperty } from '../../../../../src/utils/propertyAccess';
import { spacing, typography } from '../../../../../src/theme';
import { useTheme } from '../../../../../src/theme/useTheme';

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

export default function PhotoUploadScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId?: string | string[] }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Handle array params (Expo Router sometimes returns arrays)
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const spaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const cached = usePropertiesStore.getState().byId[id];
      if (cached) {
        if (!cancelled) setCanEdit(canEditProperty(cached));
        return;
      }
      try {
        const prop = await usePropertiesStore.getState().fetchOne(id);
        if (!cancelled) setCanEdit(canEditProperty(prop));
      } catch {
        if (!cancelled) setCanEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access photo library is required!');
      return false;
    }
    return true;
  };

  const handlePickImages = async () => {
    if (!canEdit) return;
    try {
      if (Platform.OS !== 'web') {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;
      }

      const assets = await pickMediaFromLibraryAsync();
      if (assets?.length) {
        await uploadPhotos(assets);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to open photo library',
        'error'
      );
    }
  };

  const handleTakePhoto = async () => {
    if (!canEdit) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      // Request compatible format (JPEG) instead of HEIC
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
    }
  };


  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!id || !canEdit) return;

    setUploading(true);
    setUploadProgress({ completed: 0, total: assets.length });
    const uploadList: UploadProgress[] = assets.map((asset) => ({
      filename: asset.fileName || 'photo.jpg',
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploads(uploadList);

    try {
      const { successCount, failCount, firstErrorMessage } = await uploadImagePickerAssetsBatch(
        assets,
        (asset) => {
          const photoData: {
            property: string;
            captured_at: string;
            space?: string;
            assignment_status?: 'confirmed';
          } = {
            property: id,
            captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
          };

          if (spaceId) {
            photoData.space = spaceId;
            photoData.assignment_status = 'confirmed';
          }

          return photoData;
        },
        {
          onProgress: ({ completed, total }) =>
            setUploadProgress({ completed, total }),
          onItemComplete: (result) => {
            setUploads((prev) =>
              prev.map((upload, idx) => {
                if (idx !== result.index) return upload;
                if (result.ok) {
                  return { ...upload, progress: 100, status: 'success' as const };
                }
                return { ...upload, status: 'error' as const };
              })
            );
          },
        }
      );

      const toast = formatBatchUploadToast(
        successCount,
        failCount,
        'photo(s)',
        // DO NOT REMOVE CODE — video uploads temporarily disabled:
        // 'photo(s)/video(s)',
        firstErrorMessage
      );
      if (toast) showToast(toast.message, toast.type);
      if (failCount === 0 && successCount > 0) {
        setTimeout(() => {
          router.back();
        }, 1000);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <PRGHeader title="Upload Photos" showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {!canEdit ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You have view-only access. Ask the owner for edit access to upload photos.
          </Text>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Select many photos at once from your device
              {/* DO NOT REMOVE CODE — video uploads temporarily disabled:
              Select many photos or videos at once from your device
              */}
            </Text>

            <PRGButton
              title="Pick from Library"
              onPress={handlePickImages}
              disabled={uploading}
              style={styles.button}
            />

            <PRGButton
              title="Take Photo"
              onPress={handleTakePhoto}
              disabled={uploading}
              variant="secondary"
              style={styles.button}
            />
          </>
        )}

        {uploads.length > 0 && (
          <View style={styles.uploadList}>
            {uploads.map((upload, index) => (
              <View
                key={index}
                style={[styles.uploadItem, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Text style={[styles.uploadFilename, { color: colors.text }]}>
                  {upload.filename}
                </Text>
                {upload.status === 'uploading' && (
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${upload.progress}%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                )}
                {upload.status === 'success' && (
                  <Text style={[styles.successText, { color: colors.success }]}>✓ Uploaded</Text>
                )}
                {upload.status === 'error' && (
                  <Text style={[styles.errorText, { color: colors.error }]}>✗ Failed</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <PRGLoadingOverlay
        visible={uploading}
        message={
          uploadProgress && uploadProgress.total > 0
            ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}...`
            : 'Uploading photos...'
        }
        progress={
          uploadProgress && uploadProgress.total > 0
            ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
            : undefined
        }
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
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xl,
  },
  button: {
    marginBottom: spacing.lg,
  },
  uploadList: {
    marginTop: spacing.md,
  },
  uploadItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  uploadFilename: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  successText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
});
