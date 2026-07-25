import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useToast } from '../../components';
import { spacesService } from '../../services/spacesService';
import {
  formatBatchUploadToast,
  mediaLibraryPickerOptions,
  uploadImagePickerAssetsBatch,
} from '../../services/mediaBatchUpload';
import { getInspectionTypeCopy } from '../../constants/inspectionTypes';
import { capturedAtFromExif } from '../../utils/dateTime';
import type { Inspection, Property, Space } from '../../types';
import { GuidedWalkAskNextPhase } from './GuidedWalkAskNextPhase';
import { GuidedWalkCapturePhase } from './GuidedWalkCapturePhase';
import { GuidedWalkPickPhase } from './GuidedWalkPickPhase';
import {
  isMoveOut,
  type SpacesData,
  type WalkPayload,
  type WalkPhase,
} from './guidedWalkTypes';

export type { SpacesData, WalkPayload, WalkPhase } from './guidedWalkTypes';

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
      <GuidedWalkCapturePhase
        currentSpace={currentSpace}
        spacesBody={copy.spacesBody}
        completedCount={completedIds.length}
        photoCount={photoCount}
        property={property}
        uploading={uploading}
        saving={saving}
        pendingCapture={pendingCapture}
        onTakePhoto={handleTakePhoto}
        onPickImages={handlePickImages}
        onFinishSpace={finishCurrentSpace}
        onCancelPending={() => setPendingCapture(null)}
        onClearPending={() => setPendingCapture(null)}
        onSubmitPending={async ({ notes }) => {
          if (!pendingCapture || !property || !currentSpace) return;
          await uploadPhotosForSpace(
            currentSpace,
            property.id,
            [pendingCapture],
            [notes]
          );
        }}
      />
    );
  }

  if (phase === 'ask_next') {
    return (
      <GuidedWalkAskNextPhase
        completedCount={completedIds.length}
        remainingExisting={remainingExisting}
        saving={saving}
        onContinueWith={beginSpace}
        onAddAnother={() => {
          setPhase('pick');
          setShowAddForm(true);
        }}
        onChooseDifferent={() => {
          setPhase('pick');
          setShowAddForm(false);
        }}
        onFinishWalk={finishWalk}
      />
    );
  }

  // phase === 'pick'
  return (
    <GuidedWalkPickPhase
      pickTitle={pickTitle}
      pickBody={pickBody}
      remainingExisting={remainingExisting}
      showAddForm={showAddForm}
      allSpacesCount={allSpaces.length}
      completedCount={completedIds.length}
      property={property}
      formError={formError}
      displayName={displayName}
      spaceType={spaceType}
      customTypeName={customTypeName}
      creating={creating}
      saving={saving}
      onBeginSpace={beginSpace}
      onShowAddForm={() => setShowAddForm(true)}
      onChangeDisplayName={setDisplayName}
      onChangeSpaceType={setSpaceType}
      onChangeCustomTypeName={setCustomTypeName}
      onResetForm={resetForm}
      onCreateSpace={handleCreateSpace}
      onFinishWalk={finishWalk}
    />
  );
}
