import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PRGLoadingOverlay, PRGHeader, useToast } from '../../../../../src/components';
import { photosService } from '../../../../../src/services/photosService';
import { processImageForUpload } from '../../../../../src/services/photoUploadService';
import { usePropertiesStore } from '../../../../../src/state/propertiesStore';
import { capturedAtFromExif } from '../../../../../src/utils/cmsDateTime';
import { canEditProperty } from '../../../../../src/utils/propertyAccess';
import { colors, spacing, typography } from '../../../../../src/theme';

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

export default function PhotoUploadScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId?: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
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
      alert('Permission to access camera roll is required!');
      return false;
    }
    return true;
  };

  const handlePickImages = async () => {
    if (!canEdit) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      // Request compatible format (JPEG) instead of HEIC
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
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
    const uploadList: UploadProgress[] = assets.map(asset => ({
      filename: asset.fileName || 'photo.jpg',
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploads(uploadList);

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];

        try {
          const processed = await processImageForUpload(asset);

          const photoData: {
            property: string;
            captured_at: string;
            space?: string;
            assignment_status?: string;
          } = {
            property: id,
            captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
          };

          if (spaceId) {
            photoData.space = spaceId;
            photoData.assignment_status = 'confirmed';
          }

          await photosService.uploadAndCreatePhoto(
            {
              base64: processed.base64,
              type: processed.mimeType,
              name: processed.fileName,
            },
            photoData
          );

          successCount += 1;
          setUploads(prev =>
            prev.map((upload, idx) =>
              idx === i ? { ...upload, progress: 100, status: 'success' as const } : upload
            )
          );
        } catch (error) {
          failCount += 1;
          console.error('Upload error:', error);
          setUploads(prev =>
            prev.map((upload, idx) =>
              idx === i ? { ...upload, status: 'error' as const } : upload
            )
          );
        }
      }

      if (failCount === 0) {
        showToast(`${successCount} photo(s) uploaded`, 'success');
        setTimeout(() => {
          router.back();
        }, 1000);
      } else if (successCount === 0) {
        showToast('Failed to upload photos', 'error');
      } else {
        showToast(`${successCount} uploaded, ${failCount} failed`, 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PRGHeader title="Upload Photos" showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {!canEdit ? (
          <Text style={styles.subtitle}>
            You have view-only access. Ask the owner for edit access to upload photos.
          </Text>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Select photos from your device to upload
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
              <View key={index} style={styles.uploadItem}>
                <Text style={styles.uploadFilename}>{upload.filename}</Text>
                {upload.status === 'uploading' && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${upload.progress}%` }]} />
                  </View>
                )}
                {upload.status === 'success' && (
                  <Text style={styles.successText}>✓ Uploaded</Text>
                )}
                {upload.status === 'error' && (
                  <Text style={styles.errorText}>✗ Failed</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <PRGLoadingOverlay visible={uploading} message="Uploading photos..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
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
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  uploadFilename: {
    fontSize: typography.fontSize.sm,
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  successText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
