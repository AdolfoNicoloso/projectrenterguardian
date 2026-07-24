import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGButton, PRGInput, PhotoCaptureNotesSheet, useToast } from '../../components';
import { spacesService } from '../../services/spacesService';
import {
  formatBatchUploadToast,
  mediaLibraryPickerOptions,
  uploadImagePickerAssetsBatch,
} from '../../services/mediaBatchUpload';
import { SPACE_TYPES } from '../../constants/spaceTypes';
import { getInspectionTypeCopy } from '../../constants/inspectionTypes';
import { capturedAtFromExif } from '../../utils/cmsDateTime';
import { spacing, typography } from '../../theme';
import { useTheme } from '../../theme/useTheme';
import type { Inspection, Property, Space } from '../../types';

type WalkPhase = 'pick' | 'capture' | 'ask_next';

type SpacesData = Record<string, { photo_ids: string[]; notes?: string }>;

type WalkPayload = {
  space_ids_in_scope?: string[];
  spaces_data?: SpacesData;
  /** When 'existing', auto-queue existing spaces (like move-out). 'pick' forces choose-first. */
  space_walk?: 'existing' | 'pick';
  walk?: {
    current_space_id?: string | null;
    completed_space_ids?: string[];
    phase?: WalkPhase;
  };
};

function isMoveOut(type?: string | null) {
  return (type || '').toLowerCase() === 'move_out';
}

export function GuidedWalkSpacesStep({
  inspection,
  property,
  allSpaces,
  payload,
  onSpaceAdded,
  onPersist,
  onFinish,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  allSpaces: Space[];
  payload: WalkPayload;
  onSpaceAdded: (space: Space) => void | Promise<void>;
  /** Persist walk progress without leaving the step. */
  onPersist: (nextPayload: WalkPayload) => Promise<void>;
  onFinish: (spaceData: SpacesData, spaceIdsInScope: string[]) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  const moveOut = isMoveOut(inspection.inspection_type);
  const spaceWalk = payload.space_walk;
  /** Reuse existing rooms: move-out default, or Move-In after tour convert. */
  const autoStartExisting =
    spaceWalk === 'pick' ? false : moveOut || spaceWalk === 'existing';

  const initialCompleted = payload.walk?.completed_space_ids || [];
  const initialScope = payload.space_ids_in_scope || [];
  const [spacesData, setSpacesData] = useState<SpacesData>(payload.spaces_data || {});
  const [scopeIds, setScopeIds] = useState<string[]>(initialScope);
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompleted);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(
    payload.walk?.current_space_id || null
  );
  const [phase, setPhase] = useState<WalkPhase>(
    payload.walk?.phase || (payload.walk?.current_space_id ? 'capture' : 'pick')
  );
  const [uploading, setUploading] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<ImagePickerAsset | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [spaceType, setSpaceType] = useState<Space['space_type']>('bedroom');
  const [customTypeName, setCustomTypeName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  const currentSpace = useMemo(
    () => allSpaces.find((s) => s.id === currentSpaceId) || null,
    [allSpaces, currentSpaceId]
  );

  const remainingExisting = useMemo(
    () => allSpaces.filter((s) => !completedIds.includes(s.id)),
    [allSpaces, completedIds]
  );

  const persistWalk = async (patch: {
    current_space_id?: string | null;
    completed_space_ids?: string[];
    phase?: WalkPhase;
    space_ids_in_scope?: string[];
    spaces_data?: SpacesData;
  }) => {
    const next: WalkPayload = {
      space_ids_in_scope: patch.space_ids_in_scope ?? scopeIds,
      spaces_data: patch.spaces_data ?? spacesData,
      space_walk: payload.space_walk,
      walk: {
        current_space_id:
          patch.current_space_id !== undefined ? patch.current_space_id : currentSpaceId,
        completed_space_ids: patch.completed_space_ids ?? completedIds,
        phase: patch.phase ?? phase,
      },
    };
    await onPersist(next);
  };

  const beginSpace = async (space: Space) => {
    const nextScope = scopeIds.includes(space.id) ? scopeIds : [...scopeIds, space.id];
    setScopeIds(nextScope);
    setCurrentSpaceId(space.id);
    setPhase('capture');
    setShowAddForm(false);
    setSpacesData((prev) => ({
      ...prev,
      [space.id]: prev[space.id] || { photo_ids: [] },
    }));
    await persistWalk({
      current_space_id: space.id,
      phase: 'capture',
      space_ids_in_scope: nextScope,
      spaces_data: {
        ...spacesData,
        [space.id]: spacesData[space.id] || { photo_ids: [] },
      },
    });
  };

  // Move-out / reuse-walk: auto-start the first incomplete space.
  useEffect(() => {
    if (bootstrapped) return;
    setBootstrapped(true);
    if (!autoStartExisting || phase !== 'pick' || currentSpaceId) return;
    const next = remainingExisting[0];
    if (next) {
      void beginSpace(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, allSpaces.length, autoStartExisting]);

  const resetForm = () => {
    setDisplayName('');
    setSpaceType('bedroom');
    setCustomTypeName('');
    setFormError('');
    setShowAddForm(false);
  };

  const handleCreateSpace = async () => {
    if (!property?.id) {
      setFormError('Property is missing');
      return;
    }
    if (!displayName.trim()) {
      setFormError('Display name is required');
      return;
    }
    if (spaceType === 'custom_space_type' && !customTypeName.trim()) {
      setFormError('Custom type name is required');
      return;
    }

    setFormError('');
    setCreating(true);
    try {
      const created = await spacesService.createSpace({
        property: property.id,
        space_type: spaceType,
        display_name: displayName.trim(),
        ...(spaceType === 'custom_space_type'
          ? { custom_space_type: customTypeName.trim() }
          : {}),
      });
      await onSpaceAdded(created);
      showToast(`Added ${created.display_name}`, 'success');
      resetForm();
      await beginSpace(created);
    } catch (error: any) {
      setFormError(error?.message || 'Failed to create space');
      showToast('Failed to create space', 'error');
    } finally {
      setCreating(false);
    }
  };

  const requestLibraryPermission = async () => {
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

  const uploadPhotosForSpace = async (
    space: Space,
    propertyId: string,
    assets: ImagePickerAsset[],
    notesByIndex?: (string | undefined)[]
  ) => {
    setUploading(true);
    try {
      const { successes, failCount, firstErrorMessage } = await uploadImagePickerAssetsBatch(
        assets,
        (asset, index) => {
          const note = notesByIndex?.[index]?.trim();
          return {
            property: propertyId,
            space: space.id,
            assignment_status: 'confirmed' as const,
            notes: note || undefined,
            captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
          };
        }
      );
      const newPhotoIds = successes.map((photo) => photo.id);

      const nextData: SpacesData = {
        ...spacesData,
        [space.id]: {
          photo_ids: [...(spacesData[space.id]?.photo_ids || []), ...newPhotoIds],
          notes: spacesData[space.id]?.notes,
        },
      };
      setSpacesData(nextData);
      await persistWalk({ spaces_data: nextData });
      if (failCount === 0 && newPhotoIds.length > 0) {
        showToast(
          `${newPhotoIds.length} photo(s) added to ${space.display_name}`,
          'success'
        );
      } else {
        const toast = formatBatchUploadToast(
          newPhotoIds.length,
          failCount,
          'photo(s)',
          firstErrorMessage
        );
        if (toast) showToast(toast.message, toast.type);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload photos', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePickImages = async () => {
    if (!property || !currentSpace) return;
    const ok = await requestLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync(
      mediaLibraryPickerOptions({ imagesOnly: true })
    );
    if (!result.canceled && result.assets) {
      await uploadPhotosForSpace(currentSpace, property.id, result.assets);
    }
  };

  const handleTakePhoto = async () => {
    if (!property || !currentSpace) return;
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

  const finishCurrentSpace = async () => {
    if (!currentSpaceId) return;
    const nextCompleted = completedIds.includes(currentSpaceId)
      ? completedIds
      : [...completedIds, currentSpaceId];
    setCompletedIds(nextCompleted);
    setCurrentSpaceId(null);
    setPhase('ask_next');
    await persistWalk({
      completed_space_ids: nextCompleted,
      current_space_id: null,
      phase: 'ask_next',
    });
  };

  const finishWalk = () => {
    onFinish(spacesData, scopeIds);
  };

  const pickTitle =
    completedIds.length === 0
      ? autoStartExisting && allSpaces.length > 0
        ? 'Start with the first space'
        : allSpaces.length === 0
          ? 'Add your first space'
          : 'Choose your first space'
      : 'Choose the next space';

  const pickBody =
    completedIds.length === 0
      ? autoStartExisting && allSpaces.length > 0
        ? 'We will walk through each existing room. You can still add a space that was missing before.'
        : 'Document one space at a time. Add a room or pick one that already exists, then capture photos before moving on.'
      : remainingExisting.length > 0
        ? 'Pick another existing space, add a new one, or finish if you are done.'
        : 'Add another space if needed, or finish documenting spaces.';

  if (phase === 'capture' && currentSpace) {
    const photoCount = spacesData[currentSpace.id]?.photo_ids?.length || 0;
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{currentSpace.display_name}</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{copy.spacesBody}</Text>
        <Text style={[styles.progressNote, { color: colors.textSecondary }]}>
          {completedIds.length} space{completedIds.length === 1 ? '' : 's'} done · {photoCount}{' '}
          photo{photoCount === 1 ? '' : 's'} here
        </Text>

        {property ? (
          <>
            <PRGButton
              title="Take photo"
              onPress={handleTakePhoto}
              disabled={uploading || saving || !!pendingCapture}
              variant="primary"
              style={styles.actionButton}
            />
            <PRGButton
              title="Pick from library"
              onPress={handlePickImages}
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
          onPress={finishCurrentSpace}
          disabled={uploading || saving || !!pendingCapture}
          variant="secondary"
          style={styles.continueButton}
          accessibilityLabel="Finish documenting this space"
        />

        <PhotoCaptureNotesSheet
          visible={!!pendingCapture}
          previewUri={pendingCapture?.uri}
          onCancel={() => setPendingCapture(null)}
          onFinished={() => setPendingCapture(null)}
          onSubmit={async ({ notes }) => {
            if (!pendingCapture || !property || !currentSpace) return;
            await uploadPhotosForSpace(
              currentSpace,
              property.id,
              [pendingCapture],
              [notes]
            );
          }}
        />
      </View>
    );
  }

  if (phase === 'ask_next') {
    const nextExisting = remainingExisting[0];
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>What’s next?</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          {completedIds.length} space{completedIds.length === 1 ? '' : 's'} documented.
          {remainingExisting.length > 0
            ? ` ${remainingExisting.length} existing space${remainingExisting.length === 1 ? '' : 's'} still available.`
            : ''}
        </Text>

        {nextExisting ? (
          <PRGButton
            title={`Continue with ${nextExisting.display_name}`}
            onPress={() => beginSpace(nextExisting)}
            variant="primary"
            style={styles.actionButton}
          />
        ) : null}

        <PRGButton
          title="Add another space"
          onPress={() => {
            setPhase('pick');
            setShowAddForm(true);
          }}
          variant="secondary"
          style={styles.actionButton}
        />

        {remainingExisting.length > 1 ? (
          <PRGButton
            title="Choose a different space"
            onPress={() => {
              setPhase('pick');
              setShowAddForm(false);
            }}
            variant="ghost"
            style={styles.actionButton}
          />
        ) : null}

        <PRGButton
          title="No more spaces — continue"
          onPress={finishWalk}
          loading={saving}
          disabled={completedIds.length === 0}
          variant={completedIds.length === 0 ? 'secondary' : 'primary'}
          style={styles.continueButton}
          accessibilityLabel="Finish documenting spaces"
        />
      </View>
    );
  }

  // phase === 'pick'
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{pickTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{pickBody}</Text>

      {remainingExisting.length > 0 && !showAddForm ? (
        <View style={styles.listBlock}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Existing spaces
          </Text>
          {remainingExisting.map((space) => (
            <PRGButton
              key={space.id}
              title={space.display_name}
              onPress={() => beginSpace(space)}
              variant="secondary"
              style={styles.spaceButton}
              accessibilityLabel={`Document ${space.display_name}`}
            />
          ))}
        </View>
      ) : null}

      {property?.id ? (
        <View
          style={[
            styles.addSpaceCard,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {!showAddForm ? (
            <PRGButton
              title={
                allSpaces.length === 0 || remainingExisting.length === 0
                  ? completedIds.length === 0
                    ? 'Add the first space'
                    : 'Add a space'
                  : 'Add a new space'
              }
              onPress={() => setShowAddForm(true)}
              variant="primary"
              style={styles.spaceButton}
            />
          ) : (
            <View>
              <Text style={[styles.addSpaceTitle, { color: colors.text }]}>New space</Text>
              {formError ? (
                <Text style={[styles.inlineError, { color: colors.error }]}>{formError}</Text>
              ) : null}
              <PRGInput
                label="Display name *"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g., Bedroom 2, Patio"
                autoCapitalize="words"
              />
              <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
                Space type *
              </Text>
              <View style={styles.spaceTypeOptions}>
                {SPACE_TYPES.map((type) => (
                  <PRGButton
                    key={type.value}
                    title={type.label}
                    onPress={() => {
                      setSpaceType(type.value);
                      if (type.value !== 'custom_space_type') setCustomTypeName('');
                    }}
                    variant={spaceType === type.value ? 'primary' : 'secondary'}
                    style={styles.spaceTypeChip}
                  />
                ))}
              </View>
              {spaceType === 'custom_space_type' ? (
                <PRGInput
                  label="Custom type name *"
                  value={customTypeName}
                  onChangeText={setCustomTypeName}
                  placeholder="e.g., Attic"
                  autoCapitalize="words"
                  maxLength={255}
                />
              ) : null}
              <View style={styles.addSpaceActions}>
                <PRGButton
                  title="Cancel"
                  onPress={resetForm}
                  variant="ghost"
                  disabled={creating}
                  style={styles.addSpaceActionButton}
                />
                <PRGButton
                  title="Save & document"
                  onPress={handleCreateSpace}
                  loading={creating}
                  disabled={
                    creating ||
                    !displayName.trim() ||
                    (spaceType === 'custom_space_type' && !customTypeName.trim())
                  }
                  style={styles.addSpaceActionButton}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {completedIds.length > 0 ? (
        <PRGButton
          title="No more spaces — continue"
          onPress={finishWalk}
          loading={saving}
          variant="secondary"
          style={styles.continueButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  stepNote: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  progressNote: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  listBlock: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  addSpaceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addSpaceTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  spaceTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spaceTypeChip: {
    marginBottom: 0,
  },
  addSpaceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addSpaceActionButton: {
    minWidth: 100,
  },
  inlineError: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
