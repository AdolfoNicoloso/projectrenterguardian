import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActionSheetIOS } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { PRGPhotoGrid, PRGEmptyState, useToast, PRGLoadingOverlay, SVGIcon } from '../components';
import { photosService } from '../services/photosService';
import { processImageForUpload } from '../services/photoUploadService';
import { capturedAtFromExif } from '../utils/cmsDateTime';
import { colors, spacing, typography } from '../theme';
import type { Photo } from '../types';
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
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadPhotos = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false;
    try {
      // Only blank the tab when we have nothing to show yet.
      if (!soft) {
        setLoading(true);
      }
      const status = filter === 'all' ? undefined : filter;
      const data = await photosService.getPhotos(propertyId, { status });
      setPhotos(data);
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
        type: '*/*',
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

  const processDocumentFile = async (document: DocumentPicker.DocumentPickerAsset): Promise<{ base64: string; mimeType: string; fileName: string }> => {
    if (!document.uri) {
      throw new Error('Document URI is missing');
    }

    const base64Data = await FileSystem.readAsStringAsync(document.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = document.mimeType || 'application/octet-stream';
    const fileName = document.name || `file-${Date.now()}`;

    return {
      base64: `data:${mimeType};base64,${base64Data}`,
      mimeType,
      fileName,
    };
  };

  const uploadDocumentFiles = async (documents: DocumentPicker.DocumentPickerAsset[]) => {
    if (!propertyId || !canEdit) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        try {
          const processed = await processDocumentFile(document);
          await photosService.uploadAndCreatePhoto(
            {
              base64: processed.base64,
              type: processed.mimeType,
              name: processed.fileName,
            },
            {
              property: propertyId,
              captured_at: document.modificationTime
                ? new Date(document.modificationTime).toISOString()
                : new Date().toISOString(),
            }
          );
          successCount += 1;
        } catch (error) {
          failCount += 1;
          console.error('Upload error:', error);
        }
      }

      if (failCount === 0) {
        showToast(`${successCount} file(s) uploaded`, 'success');
      } else if (successCount === 0) {
        showToast('Failed to upload files', 'error');
      } else {
        showToast(`${successCount} uploaded, ${failCount} failed`, 'error');
      }
      await loadPhotos({ soft: true });
    } finally {
      setUploading(false);
    }
  };

  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!propertyId || !canEdit) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
          const processed = await processImageForUpload(asset);
          await photosService.uploadAndCreatePhoto(
            {
              base64: processed.base64,
              type: processed.mimeType,
              name: processed.fileName,
            },
            {
              property: propertyId,
              captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
            }
          );
          successCount += 1;
        } catch (error) {
          failCount += 1;
          console.error('Upload error:', error);
        }
      }

      if (failCount === 0) {
        showToast(`${successCount} photo(s) uploaded`, 'success');
      } else if (successCount === 0) {
        showToast('Failed to upload photos', 'error');
      } else {
        showToast(`${successCount} uploaded, ${failCount} failed`, 'error');
      }
      await loadPhotos({ soft: true });
    } finally {
      setUploading(false);
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
      handlePickImages();
    } else {
      Alert.alert(
        'Upload Photos',
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
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filter, filter === 'all' && styles.filterActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filter, filter === 'unassigned' && styles.filterActive]}
            onPress={() => setFilter('unassigned')}
          >
            <Text style={[styles.filterText, filter === 'unassigned' && styles.filterTextActive]}>
              Unassigned
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filter, filter === 'assigned' && styles.filterActive]}
            onPress={() => setFilter('assigned')}
          >
            <Text style={[styles.filterText, filter === 'assigned' && styles.filterTextActive]}>
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
            onPhotoPress={(photo) => router.push(`/(tabs)/properties/${propertyId}/photos/${photo.id}`)}
            onPhotoSelect={() => {}}
            showSelection={false}
          />
        )}
      </ScrollView>

      <PRGLoadingOverlay visible={uploading} message="Uploading photos..." />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
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
  filterActive: {
    backgroundColor: colors.primary + '20',
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
