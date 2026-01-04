import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PRGLoadingOverlay, PRGHeader, useToast } from '../../../../../src/components';
import { photosService } from '../../../../../src/services/photosService';
import { processImageForUpload } from '../../../../../src/services/photoUploadService';
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

  // Handle array params (Expo Router sometimes returns arrays)
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const spaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access camera roll is required!');
      return false;
    }
    return true;
  };

  const handlePickImages = async () => {
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
    if (!id) return;

    setUploading(true);
    const uploadList: UploadProgress[] = assets.map(asset => ({
      filename: asset.fileName || 'photo.jpg',
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploads(uploadList);

    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];

        // Process image (handles HEIC conversion and base64 conversion)
        const processed = await processImageForUpload(asset);

        const file = {
          base64: processed.base64,
          type: processed.mimeType,
          name: processed.fileName,
        };

        // Upload file and get file ID
        const fileId = await photosService.uploadFile(file);

        // Create photo metadata with space assignment
        // If spaceId is provided (uploading from space screen), assign to that space
        // Otherwise, don't pass space/assignment_status - let Directus use defaults
        const photoData: {
          property: string;
          file: string;
          captured_at: string;
          space?: string;
          assignment_status?: string;
        } = {
          property: id,
          file: fileId,
          captured_at: asset.exif?.DateTimeOriginal
            ? new Date(asset.exif.DateTimeOriginal).toISOString()
            : new Date().toISOString(),
        };

        // Only set space and assignment_status if uploading from a space screen
        if (spaceId) {
          photoData.space = spaceId;
          photoData.assignment_status = 'confirmed';
        }
        // Otherwise, let Directus handle defaults for space and assignment_status

        await photosService.createPhoto(photoData);

        // Update progress
        setUploads(prev =>
          prev.map((upload, idx) =>
            idx === i ? { ...upload, progress: 100, status: 'success' as const } : upload
          )
        );
      }

      showToast(`${assets.length} photo(s) uploaded`, 'success');
      
      // Navigate back to whatever screen we came from
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload photos', 'error');
      setUploads(prev =>
        prev.map(upload =>
          upload.status === 'uploading' ? { ...upload, status: 'error' as const } : upload
        )
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PRGHeader title="Upload Photos" showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
