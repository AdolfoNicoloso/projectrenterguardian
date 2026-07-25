import React, { useState } from 'react';
import { View, Text, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PhotoCaptureNotesSheet, useToast } from '../../components';
import { photosService } from '../../services/photosService';
import { processImageForUpload } from '../../services/photoUploadService';
import {
  formatBatchUploadToast,
  mediaLibraryPickerOptions,
  uploadImagePickerAssetsBatch,
} from '../../services/mediaBatchUpload';
import { getInspectionTypeCopy } from '../../constants/inspectionTypes';
import { capturedAtFromExif } from '../../utils/dateTime';
import { useTheme } from '../../theme/useTheme';
import type { Inspection, Property } from '../../types';
import { styles } from './wizardStyles';

export function CaptureOverviewStep({
  inspection,
  property,
  payload,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  payload: any;
  onContinue: (photoIds: string[]) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  const [photoIds, setPhotoIds] = useState<string[]>(payload.photo_ids || []);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ filename: string; status: 'uploading' | 'success' | 'error' }[]>([]);
  const [pendingCapture, setPendingCapture] = useState<ImagePickerAsset | null>(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        (window as any).alert('Permission to access camera roll is required!');
      } else {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      }
      return false;
    }
    return true;
  };

  const handlePickImages = async () => {
    if (!property) {
      showToast('Property not loaded', 'error');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync(
      mediaLibraryPickerOptions({ imagesOnly: true })
    );

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
    }
  };

  const handleTakePhoto = async () => {
    if (!property) {
      showToast('Property not loaded', 'error');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        (window as any).alert('Permission to access camera is required!');
      } else {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPendingCapture(result.assets[0]);
    }
  };

  const uploadSingleWithNotes = async (asset: ImagePickerAsset, notes: string) => {
    if (!property) throw new Error('Property not loaded');

    const processed = await processImageForUpload(asset);
    const photo = await photosService.uploadAndCreatePhoto(
      {
        base64: processed.base64,
        uri: processed.uri,
        type: processed.mimeType,
        name: processed.fileName,
        byteSize: processed.byteSize,
      },
      {
        property: property.id,
        notes: notes || undefined,
        captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
      }
    );
    setPhotoIds((prev) => [...prev, photo.id]);
  };

  const uploadPhotos = async (assets: ImagePickerAsset[]) => {
    if (!property) return;

    setUploading(true);
    const statusList: { filename: string; status: 'uploading' | 'success' | 'error' }[] = assets.map(asset => ({
      filename: asset.fileName || 'photo.jpg',
      status: 'uploading',
    }));
    setUploadStatus(statusList);

    try {
      const { successes, failCount, firstErrorMessage } = await uploadImagePickerAssetsBatch(
        assets,
        (asset) => ({
          property: property.id,
          captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
        }),
        {
          onItemComplete: (result) => {
            setUploadStatus((prev) =>
              prev.map((status, idx) =>
                idx === result.index
                  ? { ...status, status: result.ok ? 'success' : 'error' }
                  : status
              )
            );
          },
        }
      );

      const newPhotoIds = successes.map((photo) => photo.id);
      setPhotoIds((prev) => [...prev, ...newPhotoIds]);
      const toast = formatBatchUploadToast(
        newPhotoIds.length,
        failCount,
        'photo(s)',
        firstErrorMessage
      );
      if (toast) showToast(toast.message, toast.type);
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload photos', 'error');
    } finally {
      setUploading(false);
      // Clear status after a delay
      setTimeout(() => setUploadStatus([]), 2000);
    }
  };

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Capture Overview Photos</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {copy.overviewBody}
      </Text>

      <PRGButton
        title="Pick from Library"
        onPress={handlePickImages}
        disabled={uploading || saving || !!pendingCapture}
        variant="secondary"
        style={styles.uploadButton}
      />

      <PRGButton
        title="Take Photo"
        onPress={handleTakePhoto}
        disabled={uploading || saving || !!pendingCapture}
        variant="secondary"
        style={styles.uploadButton}
      />

      {photoIds.length > 0 && (
        <View style={[styles.photoCountContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.photoCountText, { color: colors.text }]}>
            {photoIds.length} photo{photoIds.length !== 1 ? 's' : ''} uploaded
          </Text>
        </View>
      )}

      {uploadStatus.length > 0 && (
        <View style={styles.uploadList}>
          {uploadStatus.map((status, index) => (
            <View
              key={index}
              style={[styles.uploadItem, { backgroundColor: colors.backgroundSecondary }]}
            >
              <Text style={[styles.uploadFilename, { color: colors.text }]}>{status.filename}</Text>
              {status.status === 'uploading' && (
                <Text style={[styles.uploadStatus, { color: colors.textSecondary }]}>Uploading...</Text>
              )}
              {status.status === 'success' && (
                <Text style={[styles.successText, { color: colors.success }]}>✓ Uploaded</Text>
              )}
              {status.status === 'error' && (
                <Text style={[styles.errorText, { color: colors.error }]}>✗ Failed</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <PRGButton
        title="Continue"
        onPress={() => onContinue(photoIds)}
        variant="primary"
        loading={saving}
        disabled={uploading || !!pendingCapture}
        style={styles.continueButton}
      />

      <PhotoCaptureNotesSheet
        visible={!!pendingCapture}
        previewUri={pendingCapture?.uri}
        onCancel={() => setPendingCapture(null)}
        onFinished={() => {
          setPendingCapture(null);
          showToast('Photo submitted', 'success');
        }}
        onSubmit={async ({ notes }) => {
          if (!pendingCapture) return;
          await uploadSingleWithNotes(pendingCapture, notes);
        }}
      />
    </View>
  );
}
