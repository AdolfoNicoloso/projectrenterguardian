import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActionSheetIOS } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { PRGHeader, PRGPhotoGrid, PRGEmptyState, useToast, PRGLoadingOverlay, SVGIcon } from '../../../../../../src/components';
import { photosService } from '../../../../../../src/services/photosService';
import { PHOTO_DOCUMENT_PICKER_TYPES } from '../../../../../../src/services/photoUploadService';
import {
  formatBatchUploadToast,
  mapWithConcurrency,
  pickMediaFromLibraryAsync,
  uploadImagePickerAssetsBatch,
} from '../../../../../../src/services/mediaBatchUpload';
import { usePropertiesStore } from '../../../../../../src/state/propertiesStore';
import { capturedAtFromExif } from '../../../../../../src/utils/dateTime';
import { canEditProperty } from '../../../../../../src/utils/propertyAccess';
import { spacing, typography } from '../../../../../../src/theme';
import { useTheme } from '../../../../../../src/theme/useTheme';
import type { Photo } from '../../../../../../src/types';
import PlusFillIcon from '../../../../../../assets/nav_bar_symbols_final/plus.fill.svg';

export default function AddPhotosScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [loading, setLoading] = useState(true);
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

  const loadPhotos = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const status = filter === 'all' ? undefined : filter;
      const data = await photosService.getPhotos(id, {
        status,
        fields: 'gallery',
      });
      setPhotos(data);
    } catch (error) {
      console.error('Error loading photos:', error);
      showToast('Failed to load photos', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, filter, showToast]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

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
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
    }
  };

  const handlePickFiles = async () => {
    if (!canEdit) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...PHOTO_DOCUMENT_PICKER_TYPES],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        await uploadDocumentFiles(result.assets);
      }
    } catch (error) {
      console.error('Error picking files:', error);
      showToast('Failed to pick files', 'error');
    }
  };

  const processDocumentFile = async (
    document: DocumentPicker.DocumentPickerAsset
  ): Promise<{
    base64?: string;
    uri?: string;
    mimeType: string;
    fileName: string;
    byteSize?: number;
  }> => {
    if (!document.uri) {
      throw new Error('Document URI is missing');
    }

    const mimeType = document.mimeType || 'application/octet-stream';
    const fileName = document.name || `file-${Date.now()}`;
    const byteSize = typeof document.size === 'number' ? document.size : undefined;

    if (mimeType.toLowerCase().startsWith('video/')) {
      throw new Error('Video uploads are temporarily disabled');
    }

    const base64Data = await FileSystem.readAsStringAsync(document.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      base64: `data:${mimeType};base64,${base64Data}`,
      mimeType,
      fileName,
      byteSize,
    };
  };

  const uploadDocumentFiles = async (documents: DocumentPicker.DocumentPickerAsset[]) => {
    if (!id || !spaceId || !canEdit) return;

    setUploading(true);
    setUploadProgress({ completed: 0, total: documents.length });

    try {
      const { successCount, failCount, firstErrorMessage } = await mapWithConcurrency(
        documents,
        3,
        async (document) => {
          const processed = await processDocumentFile(document);
          return photosService.uploadAndCreatePhoto(
            {
              base64: processed.base64,
              uri: processed.uri,
              type: processed.mimeType,
              name: processed.fileName,
              byteSize: processed.byteSize,
            },
            {
              property: id,
              captured_at: new Date().toISOString(),
              space: spaceId,
              assignment_status: 'confirmed' as const,
            }
          );
        },
        ({ completed, total }) => setUploadProgress({ completed, total })
      );

      const toast = formatBatchUploadToast(
        successCount,
        failCount,
        'file(s)',
        firstErrorMessage
      );
      if (toast) showToast(toast.message, toast.type);
      await loadPhotos();
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleUploadPhotos = () => {
    if (!canEdit) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Photo Library', 'Choose Files'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handlePickImages();
          } else if (buttonIndex === 3) {
            handlePickFiles();
          }
        }
      );
    } else if (Platform.OS === 'web') {
      // On web, directly open the native browser file picker
      handlePickImages();
    } else {
      Alert.alert(
        'Upload photos',
        'Choose an option',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Take Photo',
            onPress: handleTakePhoto,
          },
          {
            text: 'Photo Library',
            onPress: handlePickImages,
          },
          {
            text: 'Choose Files',
            onPress: handlePickFiles,
          },
        ],
        { cancelable: true }
      );
    }
  };

  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!id || !spaceId || !canEdit) return;

    setUploading(true);
    setUploadProgress({ completed: 0, total: assets.length });

    try {
      const { successCount, failCount, firstErrorMessage } = await uploadImagePickerAssetsBatch(
        assets,
        (asset) => ({
          property: id,
          captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
          space: spaceId,
          assignment_status: 'confirmed' as const,
        }),
        {
          onProgress: ({ completed, total }) =>
            setUploadProgress({ completed, total }),
        }
      );

      const toast = formatBatchUploadToast(
        successCount,
        failCount,
        'photo(s)',
        firstErrorMessage
      );
      if (toast) showToast(toast.message, toast.type);
      await loadPhotos();
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handlePhotoPress = (photo: Photo) => {
    if (!spaceId || !canEdit) return;

    // Assign photo to current space
    photosService
      .updatePhoto(photo.id, {
        space: spaceId,
        assignment_status: 'confirmed',
      })
      .then(() => {
        showToast('Photo assigned to space', 'success');
        loadPhotos();
      })
      .catch((error) => {
        console.error('Error assigning photo:', error);
        showToast('Failed to assign photo', 'error');
      });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <PRGHeader
        title="Add Photos"
        showBack
        rightAction={
          canEdit
            ? {
                icon: <SVGIcon source={PlusFillIcon} size={24} />,
                onPress: handleUploadPhotos,
              }
            : undefined
        }
      />
      <View
        style={[
          styles.filters,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.filter,
            filter === 'all' && { backgroundColor: colors.primary + '20' },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'all' && {
                color: colors.primary,
                fontWeight: typography.fontWeight.semibold,
              },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filter,
            filter === 'unassigned' && { backgroundColor: colors.primary + '20' },
          ]}
          onPress={() => setFilter('unassigned')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'unassigned' && {
                color: colors.primary,
                fontWeight: typography.fontWeight.semibold,
              },
            ]}
          >
            Unassigned
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filter,
            filter === 'assigned' && { backgroundColor: colors.primary + '20' },
          ]}
          onPress={() => setFilter('assigned')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'assigned' && {
                color: colors.primary,
                fontWeight: typography.fontWeight.semibold,
              },
            ]}
          >
            Assigned
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && photos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={{ color: colors.textSecondary }}>Loading...</Text>
          </View>
        ) : photos.length === 0 ? (
          <PRGEmptyState
            title="No Photos"
            message={canEdit ? 'Upload photos to get started' : 'No photos yet'}
          />
        ) : (
          <PRGPhotoGrid
            photos={photos}
            selectedIds={[]}
            onPhotoPress={handlePhotoPress}
            onPhotoSelect={() => {}}
            showSelection={false}
            enablePreviewOnLongPress={true}
            enablePreviewOnTap={false}
          />
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
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 8,
  },
  filterText: {
    fontSize: typography.fontSize.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
