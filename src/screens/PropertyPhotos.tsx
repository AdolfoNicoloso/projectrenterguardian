import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActionSheetIOS } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { PRGPhotoGrid, PRGEmptyState, useToast, PRGLoadingOverlay, SVGIcon } from '../components';
import { photosService } from '../services/photosService';
import { spacesService } from '../services/spacesService';
import { PHOTO_DOCUMENT_PICKER_TYPES } from '../services/photoUploadService';
import {
  formatBatchUploadToast,
  mapWithConcurrency,
  pickMediaFromLibraryAsync,
  uploadImagePickerAssetsBatch,
} from '../services/mediaBatchUpload';
import { capturedAtFromExif } from '../utils/dateTime';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Photo, Space } from '../types';
import PlusFillIcon from '../../assets/nav_bar_symbols_final/plus.fill.svg';

interface PropertyPhotosProps {
  propertyId: string;
  canEdit?: boolean;
}

export const PropertyPhotos: React.FC<PropertyPhotosProps> = ({
  propertyId,
  canEdit = true,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [spacesById, setSpacesById] = useState<Record<string, Space>>({});
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const loadPhotos = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false;
    try {
      // Only blank the tab when we have nothing to show yet.
      if (!soft) {
        setLoading(true);
      }
      const status = filter === 'all' ? undefined : filter;
      const [data, spaceList] = await Promise.all([
        photosService.getPhotos(propertyId, {
          status,
          fields: 'gallery',
        }),
        spacesService.getSpaces(propertyId),
      ]);
      setPhotos(data);
      const map: Record<string, Space> = {};
      for (const s of spaceList) map[s.id] = s;
      setSpacesById(map);
    } catch (error) {
      console.error('Error loading photos:', error);
      showToast('Failed to load photos', 'error');
    } finally {
      setLoading(false);
    }
  }, [propertyId, filter, showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadPhotos({ soft: true });
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
      // Native path needs an explicit permission prompt; web uses DocumentPicker.
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
    if (!propertyId || !canEdit) return;

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
              property: propertyId,
              captured_at: new Date().toISOString(),
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
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
    await loadPhotos({ soft: true });
  };

  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!propertyId || !canEdit) return;

    setUploading(true);
    setUploadProgress({ completed: 0, total: assets.length });

    try {
      const { successCount, failCount, firstErrorMessage } =
        await uploadImagePickerAssetsBatch(
          assets,
          (asset) => ({
            property: propertyId,
            captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
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
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
    await loadPhotos({ soft: true });
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

  if (loading && photos.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <View
        style={[
          styles.filters,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.filterTabs}>
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
        {canEdit ? (
          <TouchableOpacity
            style={styles.plusButton}
            onPress={handleUploadPhotos}
          >
            <SVGIcon source={PlusFillIcon} size={24} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {photos.length === 0 ? (
          <PRGEmptyState
            title="No Photos"
            message={canEdit ? 'Upload photos to get started' : 'No photos yet'}
          />
        ) : (
          <PRGPhotoGrid
            photos={photos}
            selectedIds={[]}
            onPhotoPress={() => {}}
            onPhotoSelect={() => {}}
            showSelection={false}
            enablePreviewOnTap
            spaceLabelForPhoto={(photo) =>
              photo.space
                ? spacesById[photo.space]?.display_name || 'Assigned'
                : 'Unassigned'
            }
            onEditPhoto={(photoId) =>
              router.push(
                `/(tabs)/properties/${propertyId}/photos/${photoId}`
              )
            }
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  filterTabs: {
    flexDirection: 'row',
    flex: 1,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 8,
  },
  plusButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
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
});
