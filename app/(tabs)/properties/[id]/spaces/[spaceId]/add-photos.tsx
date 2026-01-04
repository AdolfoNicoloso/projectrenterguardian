import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActionSheetIOS } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { PRGHeader, PRGPhotoGrid, PRGEmptyState, useToast, PRGLoadingOverlay, SVGIcon } from '../../../../../../src/components';
import { photosService } from '../../../../../../src/services/photosService';
import { processImageForUpload } from '../../../../../../src/services/photoUploadService';
import { colors, spacing, typography } from '../../../../../../src/theme';
import { useTheme } from '../../../../../../src/theme/useTheme';
import type { Photo } from '../../../../../../src/types';
import PlusFillIcon from '../../../../../../assets/nav_bar_symbols_final/plus.fill.svg';

export default function AddPhotosScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; spaceId: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors: themeColors } = useTheme();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Handle array params (Expo Router sometimes returns arrays)
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const spaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;

  const loadPhotos = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const status = filter === 'all' ? undefined : filter;
      const data = await photosService.getPhotos(id, { status });
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
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
    }
  };

  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
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

    // Read file as base64
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
    if (!id || !spaceId) return;

    setUploading(true);

    try {
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        // Process document file
        const processed = await processDocumentFile(document);

        const file = {
          base64: processed.base64,
          type: processed.mimeType,
          name: processed.fileName,
        };

        // Upload file and get file ID
        const fileId = await photosService.uploadFile(file);

        // Create photo metadata with space assignment
        const photoData = {
          property: id,
          file: fileId,
          captured_at: document.modificationTime
            ? new Date(document.modificationTime).toISOString()
            : new Date().toISOString(),
          space: spaceId,
          assignment_status: 'confirmed' as const,
        };

        await photosService.createPhoto(photoData);
      }

      showToast(`${documents.length} file(s) uploaded`, 'success');
      // Reload photos to show the newly uploaded ones
      await loadPhotos();
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload files', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPhotos = () => {
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

  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!id || !spaceId) return;

    setUploading(true);

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
        const photoData = {
          property: id,
          file: fileId,
          captured_at: asset.exif?.DateTimeOriginal
            ? new Date(asset.exif.DateTimeOriginal).toISOString()
            : new Date().toISOString(),
          space: spaceId,
          assignment_status: 'confirmed' as const,
        };

        await photosService.createPhoto(photoData);
      }

      showToast(`${assets.length} photo(s) uploaded`, 'success');
      // Reload photos to show the newly uploaded ones
      await loadPhotos();
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload photos', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoPress = (photo: Photo) => {
    if (!spaceId) return;

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
    <View style={styles.container}>
      <PRGHeader
        title="Add Photos"
        showBack
        rightAction={{
          icon: <SVGIcon source={PlusFillIcon} size={24} />,
          onPress: handleUploadPhotos,
        }}
      />
      <View style={styles.filters}>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && photos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={{ color: themeColors.text }}>Loading...</Text>
          </View>
        ) : photos.length === 0 ? (
          <PRGEmptyState
            title="No Photos"
            message="Upload photos to get started"
          />
        ) : (
          <PRGPhotoGrid
            photos={photos}
            selectedIds={[]}
            onPhotoPress={handlePhotoPress}
            onPhotoSelect={() => {}}
            showSelection={false}
            enablePreviewOnLongPress={true}
          />
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
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
