import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGHeader, PRGButton, PRGInput, PRGLoadingOverlay, PRGConfirmDialog, PhotoCaptureNotesSheet, useToast } from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { spacesService } from '../../../src/services/spacesService';
import { reportsService } from '../../../src/services/reportsService';
import { photosService } from '../../../src/services/photosService';
import { processImageForUpload } from '../../../src/services/photoUploadService';
import {
  formatBatchUploadToast,
  mediaLibraryPickerOptions,
  uploadImagePickerAssetsBatch,
} from '../../../src/services/mediaBatchUpload';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { capturedAtFromExif } from '../../../src/utils/cmsDateTime';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Inspection, InspectionStep, Property, Space } from '../../../src/types';
import {
  getInspectionTypeCopy,
  getInspectionTypeLabel,
} from '../../../src/constants/inspectionTypes';
import { propertyDisplayName } from '../../../src/constants/propertyStatuses';
import { GuidedWalkSpacesStep } from '../../../src/screens/inspection/GuidedWalkSpacesStep';
import {
  countInspectionSnapshot,
  mergeInspectionWizardPayload,
} from '../../../src/utils/inspectionSnapshot';

const STEP_KEYS = [
  'intro',
  'choose_property',
  'confirm_scope',
  'capture_overview',
  'capture_spaces',
  'review',
  'complete',
] as const;

type StepKey = typeof STEP_KEYS[number];

/** Steps shown in the guided flow (confirm_scope is legacy and auto-skipped). */
const VISIBLE_STEP_KEYS: StepKey[] = STEP_KEYS.filter((k) => k !== 'confirm_scope');

const STEP_TITLES: Record<StepKey, string> = {
  intro: 'Introduction',
  choose_property: 'Choose Property',
  confirm_scope: 'Preparing',
  capture_overview: 'Capture Overview',
  capture_spaces: 'Document spaces',
  review: 'Review',
  complete: 'Complete',
};

function wizardStepsForInspection(hasProperty: boolean): StepKey[] {
  return hasProperty
    ? VISIBLE_STEP_KEYS.filter((k) => k !== 'choose_property')
    : VISIBLE_STEP_KEYS;
}

function resolvePreviousWizardStep(
  current: StepKey,
  hasProperty: boolean
): StepKey | null {
  const steps = wizardStepsForInspection(hasProperty);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1];
}

export default function InspectionWizardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [currentStep, setCurrentStep] = useState<StepKey>('intro');
  const [stepData, setStepData] = useState<InspectionStep | null>(null);
  const [allSteps, setAllSteps] = useState<InspectionStep[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteStage, setDeleteStage] = useState<null | 'confirm' | 'confirmAgain'>(null);
  const [deleting, setDeleting] = useState(false);

  const appendSpace = useCallback((space: Space) => {
    setSpaces((prev) => {
      if (prev.some((s) => s.id === space.id)) return prev;
      return [...prev, space];
    });
  }, []);

  useEffect(() => {
    if (id) {
      loadInspection();
    }
  }, [id]);

  const loadInspection = async () => {
    if (!id) return;
    try {
      // Keep wizard visible if we already have data (e.g. soft revisit).
      if (!inspection) {
        setLoading(true);
      }
      const [inspectionData, steps, propertiesData] = await Promise.all([
        inspectionsService.getInspection(id),
        inspectionsService.getInspectionSteps(id),
        usePropertiesStore
          .getState()
          .fetchList({ force: false })
          .catch(() => usePropertiesStore.getState().getList()),
      ]);
      setInspection(inspectionData);
      setProperties(propertiesData);
      setAllSteps(steps);

      let lastStep = inspectionData.last_step || 'intro';
      // Legacy multi-select step — jump into overview / walk flow.
      if (lastStep === 'confirm_scope') {
        lastStep = 'capture_overview';
      }
      const stepKey = STEP_KEYS.includes(lastStep as StepKey) ? (lastStep as StepKey) : 'intro';
      setCurrentStep(stepKey);

      const currentStepData = steps.find((s) => s.step_key === stepKey);
      if (currentStepData) {
        setStepData(currentStepData);
      }

      if (inspectionData.property_id) {
        try {
          const cached = usePropertiesStore.getState().byId[inspectionData.property_id];
          const prop =
            cached ??
            (await usePropertiesStore.getState().fetchOne(inspectionData.property_id));
          setProperty(prop);
          const spacesData = await spacesService.getSpaces(prop.id);
          setSpaces(spacesData);
        } catch (error) {
          console.error('Error loading property/spaces:', error);
        }
      }
    } catch (error) {
      console.error('Error loading inspection:', error);
      showToast('Failed to load inspection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWizardBack = async () => {
    const hasProperty = Boolean(inspection?.property_id);
    const previous = resolvePreviousWizardStep(currentStep, hasProperty);
    if (!previous) {
      router.replace('/(tabs)/inspections');
      return;
    }

    let steps = allSteps;
    if ((!steps || steps.length === 0) && id) {
      try {
        steps = await inspectionsService.getInspectionSteps(id);
        setAllSteps(steps);
      } catch (error) {
        console.error('Error loading steps for back navigation:', error);
        showToast('Failed to go back', 'error');
        return;
      }
    }

    const previousStepData = steps.find((s) => s.step_key === previous);
    if (!previousStepData) {
      showToast('Previous step not found', 'error');
      return;
    }

    setCurrentStep(previous);
    setStepData(previousStepData);

    if (id) {
      const flow = wizardStepsForInspection(hasProperty);
      const prevIndex = flow.indexOf(previous);
      const progress = Math.min(99, Math.floor(((prevIndex + 1) / flow.length) * 100));
      try {
        await inspectionsService.updateInspection(id, {
          last_step: previous,
          inspections_progress: progress,
        });
        setInspection((prev) =>
          prev
            ? { ...prev, last_step: previous, inspections_progress: progress }
            : prev
        );
      } catch (error) {
        console.error('Error updating inspection on back:', error);
      }
    }
  };

  const saveStepAndContinue = async (payload: any, nextStep?: StepKey) => {
    if (!id || !stepData) return;

    setSaving(true);
    try {
      // Calculate progress against the visible guided flow (skip legacy confirm_scope).
      const flow = wizardStepsForInspection(Boolean(inspection?.property_id));
      const flowIndex = flow.indexOf(currentStep);
      const progress = Math.min(
        99,
        Math.floor((((flowIndex >= 0 ? flowIndex : 0) + 1) / flow.length) * 100)
      );

      // Determine next step
      const next =
        nextStep ||
        flow[flowIndex >= 0 ? flowIndex + 1 : 0] ||
        'complete';

      // Update step
      await inspectionsService.updateInspectionStep(stepData.id, {
        payload_json: payload,
        inspection_step_status: 'completed',
      });

      // Mark next step as in_progress if it exists
      if (next !== 'complete') {
        const allSteps = await inspectionsService.getInspectionSteps(id);
        const nextStepData = allSteps.find((s) => s.step_key === next);
        if (nextStepData) {
          await inspectionsService.updateInspectionStep(nextStepData.id, {
            inspection_step_status: 'in_progress',
          });
        }
      }

      // Update inspection
      await inspectionsService.updateInspection(id, {
        last_step: next,
        inspections_progress: progress,
      });

      // Reload inspection
      await loadInspection();
    } catch (error) {
      console.error('Error saving step:', error);
      showToast('Failed to save step', 'error');
    } finally {
      setSaving(false);
    }
  };

  const persistCurrentStepPayload = async (payload: any) => {
    if (!stepData) return;
    try {
      const updated = await inspectionsService.updateInspectionStep(stepData.id, {
        payload_json: payload,
      });
      setStepData(updated);
    } catch (error) {
      console.error('Error persisting step payload:', error);
    }
  };

  const handleComplete = async () => {
    if (!id || !stepData || !inspection || !property) return;

    setSaving(true);
    try {
      // Mark step as completed
      await inspectionsService.updateInspectionStep(stepData.id, {
        inspection_step_status: 'completed',
      });

      // Mark inspection as completed
      await inspectionsService.updateInspection(id, {
        inspection_status: 'completed',
        completed_at: new Date().toISOString(),
        inspections_progress: 100,
        last_step: 'complete',
      });

      // Generate report from merged wizard payloads (each step only stores its fields).
      try {
        const stepsForSnapshot = await inspectionsService.getInspectionSteps(id);
        const merged = mergeInspectionWizardPayload(stepsForSnapshot);
        const baseCounts = countInspectionSnapshot(merged);

        let photoNotesCount = 0;
        try {
          const allPhotos = await photosService.getPhotos(property.id);
          const ids = new Set<string>([
            ...merged.photo_ids,
            ...Object.values(merged.spaces_data).flatMap((s) => s.photo_ids || []),
          ]);
          photoNotesCount = allPhotos.filter((p) => {
            if (!ids.has(p.id)) return false;
            if (Array.isArray(p.notes_entries) && p.notes_entries.length > 0) {
              return true;
            }
            return Boolean(p.notes && String(p.notes).trim());
          }).length;
        } catch (photoErr) {
          console.error('Error counting photo notes for report:', photoErr);
        }

        const counts = {
          ...baseCounts,
          notes_count: baseCounts.notes_count + photoNotesCount,
          photo_notes_count: photoNotesCount,
        };

        const typeCopy = getInspectionTypeCopy(inspection.inspection_type);
        const snapshotJson = {
          property: {
            id: property.id,
            nickname: property.nickname,
            address: property.address_free_text,
            state_code: property.state_code,
          },
          inspection: {
            id: inspection.id,
            type: inspection.inspection_type,
            type_label: getInspectionTypeLabel(inspection.inspection_type),
            purpose: typeCopy.introBody,
            started_at: inspection.started_at,
            completed_at: new Date().toISOString(),
          },
          spaces_covered: merged.space_ids_in_scope,
          photo_ids: merged.photo_ids,
          spaces_data: merged.spaces_data,
          user_summary_notes: merged.user_summary_notes || '',
          counts,
          disclaimer:
            'This is a user-created documentation record and does not constitute legal advice, a professional property inspection, or a guarantee of legal admissibility.',
        };

        await reportsService.createReport({
          property: property.id,
          report_type: inspection.inspection_type,
          status: 'ready',
          snapshot_json: snapshotJson,
          context_state_code: property.state_code || undefined,
        });
      } catch (reportError) {
        console.error('Error generating report:', reportError);
        // Don't fail the inspection completion if report generation fails
      }

      const doneLabel =
        inspection.inspection_type === 'tour' ? 'Tour documented' : 'Inspection completed';
      showToast(`${doneLabel}!`, 'success');
      
      // Navigate to insights
      router.replace('/(tabs)/insights');
    } catch (error) {
      console.error('Error completing inspection:', error);
      showToast('Failed to complete inspection', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <PRGHeader title="Inspection" showBack />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!inspection || !stepData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <PRGHeader title="Inspection" showBack />
        <View style={styles.errorContainer}>
          <Text style={{ color: colors.textSecondary }}>Inspection not found</Text>
        </View>
      </View>
    );
  }

  const renderStepContent = () => {
    const payload = stepData.payload_json || {};

    switch (currentStep) {
      case 'intro':
        return (
          <IntroStep
            inspection={inspection}
            onContinue={() =>
              saveStepAndContinue(
                payload,
                inspection.property_id ? 'capture_overview' : 'choose_property'
              )
            }
            saving={saving}
          />
        );
      case 'choose_property':
        return (
          <ChoosePropertyStep
            inspection={inspection}
            property={property}
            properties={properties}
            payload={payload}
            onContinue={(selectedPropertyId) => {
              saveStepAndContinue(
                { ...payload, selected_property_id: selectedPropertyId },
                'capture_overview'
              );
            }}
            saving={saving}
          />
        );
      case 'confirm_scope':
        // Legacy multi-select step — skip into the room-by-room walk flow.
        return (
          <LegacySkipScopeStep
            onSkip={() =>
              saveStepAndContinue(
                {
                  ...payload,
                  space_ids_in_scope: payload.space_ids_in_scope || [],
                },
                'capture_overview'
              )
            }
          />
        );
      case 'capture_overview':
        return (
          <CaptureOverviewStep
            inspection={inspection}
            property={property}
            payload={payload}
            onContinue={(photoIds) => {
              saveStepAndContinue({ ...payload, photo_ids: photoIds }, 'capture_spaces');
            }}
            saving={saving}
          />
        );
      case 'capture_spaces':
        return (
          <GuidedWalkSpacesStep
            inspection={inspection}
            property={property}
            allSpaces={spaces}
            payload={payload}
            onSpaceAdded={async (space) => {
              appendSpace(space);
            }}
            onPersist={persistCurrentStepPayload}
            onFinish={(spaceData, spaceIdsInScope) => {
              saveStepAndContinue(
                {
                  ...payload,
                  spaces_data: spaceData,
                  space_ids_in_scope: spaceIdsInScope,
                },
                'review'
              );
            }}
            saving={saving}
          />
        );
      case 'review': {
        const mergedPayload = mergeInspectionWizardPayload(allSteps);
        // Prefer live step payload for summary notes being edited on this screen.
        const reviewPayload = {
          ...mergedPayload,
          user_summary_notes:
            (payload as { user_summary_notes?: string }).user_summary_notes ??
            mergedPayload.user_summary_notes,
        };
        return (
          <ReviewStep
            inspection={inspection}
            property={property}
            spaces={spaces.filter((s) =>
              reviewPayload.space_ids_in_scope.includes(s.id)
            )}
            payload={reviewPayload}
            onContinue={(notes) => {
              saveStepAndContinue({ ...payload, user_summary_notes: notes }, 'complete');
            }}
            saving={saving}
          />
        );
      }
      case 'complete':
        return (
          <CompleteStep
            inspection={inspection}
            onComplete={handleComplete}
            saving={saving}
          />
        );
      default:
        return <Text>Unknown step</Text>;
    }
  };

  const flowSteps = wizardStepsForInspection(Boolean(inspection.property_id));
  const currentStepIndex = Math.max(0, flowSteps.indexOf(currentStep));
  const progress = inspection.inspections_progress;
  const isDraft = inspection.inspection_status === 'in_progress';
  const walkCompleted =
    currentStep === 'capture_spaces'
      ? ((stepData.payload_json as { walk?: { completed_space_ids?: string[] } } | undefined)
          ?.walk?.completed_space_ids?.length ?? 0)
      : 0;

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteStage(null);
  };

  const advanceOrConfirmDelete = async () => {
    if (deleting || !id) return;
    if (deleteStage === 'confirm') {
      setDeleteStage('confirmAgain');
      return;
    }
    if (deleteStage !== 'confirmAgain') return;

    setDeleting(true);
    try {
      await inspectionsService.deleteInspection(id);
      showToast('Draft inspection deleted', 'success');
      setDeleteStage(null);
      router.replace('/(tabs)/inspections');
    } catch (error) {
      console.error('Error deleting inspection:', error);
      showToast('Failed to delete inspection', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <PRGHeader
        title={STEP_TITLES[currentStep]}
        showBack
        onBack={handleWizardBack}
        rightAction={
          isDraft
            ? {
                label: 'Delete',
                onPress: () => setDeleteStage('confirm'),
              }
            : undefined
        }
      />
      <View
        style={[
          styles.progressContainer,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentStep === 'capture_spaces'
            ? walkCompleted > 0
              ? `${walkCompleted} space${walkCompleted === 1 ? '' : 's'} documented · Step ${currentStepIndex + 1} of ${flowSteps.length}`
              : `Room by room · Step ${currentStepIndex + 1} of ${flowSteps.length}`
            : `Step ${currentStepIndex + 1} of ${flowSteps.length}`}
        </Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>
      {saving && <PRGLoadingOverlay />}

      <PRGConfirmDialog
        visible={deleteStage === 'confirm'}
        title="Delete this draft?"
        message="This unfinished inspection will be removed. Photos already uploaded to the property will stay."
        cancelLabel="Keep draft"
        confirmLabel="Delete"
        destructive
        onCancel={cancelDelete}
        onConfirm={advanceOrConfirmDelete}
      />
      <PRGConfirmDialog
        visible={deleteStage === 'confirmAgain'}
        title="Are you sure?"
        message="This cannot be undone. Delete this draft inspection permanently?"
        cancelLabel="Cancel"
        confirmLabel={deleting ? 'Deleting…' : 'Delete permanently'}
        destructive
        onCancel={cancelDelete}
        onConfirm={advanceOrConfirmDelete}
      />
    </View>
  );
}

// Step Components
function IntroStep({
  inspection,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  onContinue: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{copy.introTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{copy.introBody}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Type: {getInspectionTypeLabel(inspection.inspection_type)}
      </Text>
      <PRGButton
        title="Get Started"
        onPress={onContinue}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}

function ChoosePropertyStep({
  inspection,
  property,
  properties,
  payload,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  properties: Property[];
  payload: any;
  onContinue: (propertyId: string) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const selectedId = payload.selected_property_id || inspection.property_id;
  
  // If property is already set and matches, just show it
  if (property && selectedId === property.id) {
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Property Selected</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          {propertyDisplayName(property)}
        </Text>
        <PRGButton
          title="Continue"
          onPress={() => onContinue(property.id)}
          variant="primary"
          loading={saving}
          style={styles.continueButton}
        />
      </View>
    );
  }

  // If we have properties list, show selection
  if (properties.length > 0) {
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Select Property</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Please select the property for this inspection.
        </Text>
        {properties.map((prop) => (
          <PRGButton
            key={prop.id}
            title={propertyDisplayName(prop)}
            onPress={() => onContinue(prop.id)}
            variant={selectedId === prop.id ? 'primary' : 'secondary'}
            style={styles.propertyButton}
          />
        ))}
      </View>
    );
  }

  // Fallback: use inspection property_id
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Property</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Using the property from this inspection.
      </Text>
      <PRGButton
        title="Continue"
        onPress={() => onContinue(inspection.property_id)}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}

function LegacySkipScopeStep({ onSkip }: { onSkip: () => void }) {
  const { colors } = useTheme();
  useEffect(() => {
    onSkip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Preparing your walkthrough…</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        You’ll document one space at a time—no need to select every room up front.
      </Text>
    </View>
  );
}

function CaptureOverviewStep({
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
        type: processed.mimeType,
        name: processed.fileName,
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

function ReviewStep({
  inspection,
  property,
  spaces,
  payload,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  spaces: Space[];
  payload: {
    photo_ids?: string[];
    spaces_data?: Record<string, { photo_ids?: string[]; notes?: string }>;
    space_ids_in_scope?: string[];
    user_summary_notes?: string;
  };
  onContinue: (notes: string) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState(payload.user_summary_notes || '');
  const copy = getInspectionTypeCopy(inspection.inspection_type);

  const counts = countInspectionSnapshot({
    photo_ids: payload.photo_ids || [],
    spaces_data: payload.spaces_data || {},
    space_ids_in_scope: payload.space_ids_in_scope || [],
    user_summary_notes: notes,
  });
  const spacesData = payload.spaces_data || {};

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Review</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {copy.reviewBody}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Type: {getInspectionTypeLabel(inspection.inspection_type)}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Property: {property ? propertyDisplayName(property) : '—'}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Spaces: {counts.spaces_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Overview Photos: {counts.overview_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Space Photos: {counts.space_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Total Photos: {counts.total_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Notes: {counts.notes_count}
        {notes.trim() ? ' (includes summary)' : ''}
      </Text>
      {spaces.length > 0 && (
        <View style={[styles.spaceReviewList, { backgroundColor: colors.backgroundSecondary }]}>
          {spaces.map((space) => {
            const spacePhotoCount = spacesData[space.id]?.photo_ids?.length || 0;
            const spaceNotes = spacesData[space.id]?.notes?.trim();
            return (
              <Text key={space.id} style={[styles.spaceReviewItem, { color: colors.text }]}>
                {space.display_name}: {spacePhotoCount} photo
                {spacePhotoCount !== 1 ? 's' : ''}
                {spaceNotes ? ' · notes' : ''}
              </Text>
            );
          })}
        </View>
      )}
      <PRGInput
        label="Summary Notes (Optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Add any additional notes about this inspection..."
        style={styles.notesInput}
      />
      <Text style={[styles.notesHint, { color: colors.textTertiary }]}>
        You can add more detailed notes on each photo and space — those are
        timestamped with who wrote them and can be edited later.
      </Text>
      <PRGButton
        title="Complete Inspection"
        onPress={() => onContinue(notes)}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}

function CompleteStep({
  inspection,
  onComplete,
  saving,
}: {
  inspection: Inspection;
  onComplete: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{copy.completeTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{copy.completeBody}</Text>
      <PRGButton
        title="View Report"
        onPress={onComplete}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  progressContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  stepTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  stepNote: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  addSpaceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
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
  propertyButton: {
    marginBottom: spacing.sm,
  },
  spaceItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  spaceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  spaceNote: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  reviewItem: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
  },
  notesInput: {
    marginTop: spacing.md,
  },
  notesHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
  photoCountContainer: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  photoCountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  uploadList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  uploadItem: {
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  uploadFilename: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  uploadStatus: {
    fontSize: typography.fontSize.xs,
  },
  successText: {
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
  },
  spacePhotoItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  spacePhotoCount: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  spaceUploadButton: {
    marginBottom: spacing.sm,
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  spaceReviewList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
  },
  spaceReviewItem: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
});
