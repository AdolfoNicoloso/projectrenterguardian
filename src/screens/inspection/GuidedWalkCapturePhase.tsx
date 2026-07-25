import React from 'react';
import { View, Text } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PhotoCaptureNotesSheet } from '../../components';
import { useTheme } from '../../theme/useTheme';
import type { Property, Space } from '../../types';
import { styles } from './guidedWalkStyles';

export function GuidedWalkCapturePhase({
  currentSpace,
  spacesBody,
  completedCount,
  photoCount,
  property,
  uploading,
  saving,
  pendingCapture,
  onTakePhoto,
  onPickImages,
  onFinishSpace,
  onCancelPending,
  onClearPending,
  onSubmitPending,
}: {
  currentSpace: Space;
  spacesBody: string;
  completedCount: number;
  photoCount: number;
  property: Property | null;
  uploading: boolean;
  saving: boolean;
  pendingCapture: ImagePickerAsset | null;
  onTakePhoto: () => void;
  onPickImages: () => void;
  onFinishSpace: () => void;
  onCancelPending: () => void;
  onClearPending: () => void;
  onSubmitPending: (args: { notes?: string }) => Promise<void>;
}) {
  const { colors } = useTheme();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{currentSpace.display_name}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{spacesBody}</Text>
      <Text style={[styles.progressNote, { color: colors.textSecondary }]}>
        {completedCount} space{completedCount === 1 ? '' : 's'} done · {photoCount}{' '}
        photo{photoCount === 1 ? '' : 's'} here
      </Text>

      {property ? (
        <>
          <PRGButton
            title="Take photo"
            onPress={onTakePhoto}
            disabled={uploading || saving || !!pendingCapture}
            variant="primary"
            style={styles.actionButton}
          />
          <PRGButton
            title="Pick from library"
            onPress={onPickImages}
            disabled={uploading || saving || !!pendingCapture}
            variant="secondary"
            style={styles.actionButton}
          />
        </>
      ) : (
        <Text style={[styles.stepNote, { color: colors.textSecondary }]}>Property not loaded</Text>
      )}

      {uploading ? (
        <Text style={[styles.uploadingText, { color: colors.primary }]}>Uploading…</Text>
      ) : null}

      <PRGButton
        title="Done with this space"
        onPress={onFinishSpace}
        disabled={uploading || saving || !!pendingCapture}
        variant="secondary"
        style={styles.continueButton}
        accessibilityLabel="Finish documenting this space"
      />

      <PhotoCaptureNotesSheet
        visible={!!pendingCapture}
        previewUri={pendingCapture?.uri}
        onCancel={onCancelPending}
        onFinished={onClearPending}
        onSubmit={onSubmitPending}
      />
    </View>
  );
}
