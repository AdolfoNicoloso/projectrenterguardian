import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGHeader, PRGLoadingOverlay, PRGConfirmDialog, useToast } from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { spacesService } from '../../../src/services/spacesService';
import { reportsService } from '../../../src/services/reportsService';
import { photosService } from '../../../src/services/photosService';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { useTheme } from '../../../src/theme/useTheme';
import type { Inspection, InspectionStep, Property, Space } from '../../../src/types';
import {
  getInspectionTypeCopy,
  getInspectionTypeLabel,
} from '../../../src/constants/inspectionTypes';
import { GuidedWalkSpacesStep } from '../../../src/screens/inspection/GuidedWalkSpacesStep';
import {
  countInspectionSnapshot,
  mergeInspectionWizardPayload,
} from '../../../src/utils/inspectionSnapshot';
import {
  STEP_KEYS,
  STEP_TITLES,
  type StepKey,
  wizardStepsForInspection,
  resolvePreviousWizardStep,
} from '../../../src/screens/inspection/wizardSteps';
import {
  IntroStep,
  ChoosePropertyStep,
  LegacySkipScopeStep,
  CaptureOverviewStep,
  ReviewStep,
  CompleteStep,
} from '../../../src/screens/inspection/wizardStepsIndex';
import { styles } from '../../../src/screens/inspection/wizardStyles';

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

      if (
        inspection.inspection_type === 'tour' &&
        property?.id &&
        !property.tour_completed_at
      ) {
        try {
          const { propertiesService } = await import(
            '../../../src/services/propertiesService'
          );
          await propertiesService.updateProperty(property.id, {
            tour_completed_at: new Date().toISOString(),
            tour_completed_source: 'inspection',
          });
          showToast('Tour marked as done', 'success');
        } catch (markErr) {
          console.error('Error marking tour completed:', markErr);
        }
      }

      if (inspection.inspection_type === 'move_in' && property?.id) {
        try {
          const { propertiesService } = await import(
            '../../../src/services/propertiesService'
          );
          await propertiesService.updateProperty(property.id, {
            move_in_baseline_inspection_id: inspection.id,
          });
        } catch (baselineErr) {
          console.error('Error saving move-in baseline:', baselineErr);
        }
        router.replace(
          `/onboarding/check-in-ready?propertyId=${encodeURIComponent(property.id)}`
        );
        return;
      }
      
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
      {saving ? <PRGLoadingOverlay visible message="Saving…" /> : null}

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
