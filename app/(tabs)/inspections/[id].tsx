import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PRGHeader, PRGButton, PRGInput, PRGLoadingOverlay, useToast } from '../../../src/components';
import { inspectionsService } from '../../../src/services/inspectionsService';
import { propertiesService } from '../../../src/services/propertiesService';
import { spacesService } from '../../../src/services/spacesService';
import { reportsService } from '../../../src/services/reportsService';
import { photosService } from '../../../src/services/photosService';
import { processImageForUpload } from '../../../src/services/photoUploadService';
import { colors, spacing, typography } from '../../../src/theme';
import type { Inspection, InspectionStep, Property, Space } from '../../../src/types';

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

const STEP_TITLES: Record<StepKey, string> = {
  intro: 'Introduction',
  choose_property: 'Choose Property',
  confirm_scope: 'Confirm Scope',
  capture_overview: 'Capture Overview',
  capture_spaces: 'Capture Spaces',
  review: 'Review',
  complete: 'Complete',
};

export default function InspectionWizardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [currentStep, setCurrentStep] = useState<StepKey>('intro');
  const [stepData, setStepData] = useState<InspectionStep | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadInspection();
    }
  }, [id]);

  const loadInspection = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [inspectionData, steps, propertiesData] = await Promise.all([
        inspectionsService.getInspection(id),
        inspectionsService.getInspectionSteps(id),
        propertiesService.getMyProperties().catch(() => []),
      ]);
      setInspection(inspectionData);
      setProperties(propertiesData);

      // Determine current step
      const lastStep = inspectionData.last_step || 'intro';
      const stepKey = STEP_KEYS.includes(lastStep as StepKey) ? (lastStep as StepKey) : 'intro';
      setCurrentStep(stepKey);

      // Load current step data
      const currentStepData = steps.find((s) => s.step_key === stepKey);
      if (currentStepData) {
        setStepData(currentStepData);
      }

      // Load property and spaces if needed
      if (inspectionData.property_id) {
        try {
          const prop = await propertiesService.getProperty(inspectionData.property_id);
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

  const saveStepAndContinue = async (payload: any, nextStep?: StepKey) => {
    if (!id || !stepData) return;

    setSaving(true);
    try {
      // Calculate progress
      const currentIndex = STEP_KEYS.indexOf(currentStep);
      const totalSteps = STEP_KEYS.length;
      const progress = Math.min(99, Math.floor(((currentIndex + 1) / totalSteps) * 100));

      // Determine next step
      const next = nextStep || STEP_KEYS[currentIndex + 1] || 'complete';

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

      // Generate report
      try {
        const allSteps = await inspectionsService.getInspectionSteps(id);
        const reviewStep = allSteps.find((s) => s.step_key === 'review');
        const payload = reviewStep?.payload_json || {};

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
            started_at: inspection.started_at,
            completed_at: new Date().toISOString(),
          },
          spaces_covered: payload.space_ids_in_scope || [],
          photo_ids: payload.photo_ids || [],
          spaces_data: payload.spaces_data || {},
          user_summary_notes: payload.user_summary_notes || '',
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

      showToast('Inspection completed!', 'success');
      
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
      <View style={styles.container}>
        <PRGHeader title="Inspection" showBack />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!inspection || !stepData) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Inspection" showBack />
        <View style={styles.errorContainer}>
          <Text>Inspection not found</Text>
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
            onContinue={() => saveStepAndContinue(payload, 'choose_property')}
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
              saveStepAndContinue({ ...payload, selected_property_id: selectedPropertyId }, 'confirm_scope');
            }}
            saving={saving}
          />
        );
      case 'confirm_scope':
        return (
          <ConfirmScopeStep
            spaces={spaces}
            payload={payload}
            onContinue={(spaceIds) => {
              saveStepAndContinue({ ...payload, space_ids_in_scope: spaceIds }, 'capture_overview');
            }}
            saving={saving}
          />
        );
      case 'capture_overview':
        return (
          <CaptureOverviewStep
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
          <CaptureSpacesStep
            property={property}
            spaces={spaces.filter((s) => payload.space_ids_in_scope?.includes(s.id))}
            payload={payload}
            onContinue={(spaceData) => {
              saveStepAndContinue({ ...payload, spaces_data: spaceData }, 'review');
            }}
            saving={saving}
          />
        );
      case 'review':
        return (
          <ReviewStep
            inspection={inspection}
            property={property}
            spaces={spaces.filter((s) => payload.space_ids_in_scope?.includes(s.id))}
            payload={payload}
            onContinue={(notes) => {
              saveStepAndContinue({ ...payload, user_summary_notes: notes }, 'complete');
            }}
            saving={saving}
          />
        );
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

  const currentStepIndex = STEP_KEYS.indexOf(currentStep);
  const progress = inspection.inspections_progress;

  return (
    <View style={styles.container}>
      <PRGHeader title={STEP_TITLES[currentStep]} showBack />
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Step {currentStepIndex + 1} of {STEP_KEYS.length}
        </Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>
      {saving && <PRGLoadingOverlay />}
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
  return (
    <View>
      <Text style={styles.stepTitle}>Welcome to Your Inspection</Text>
      <Text style={styles.stepDescription}>
        This inspection will help you document the condition of your property.
        You'll be guided through each step to capture photos and information.
      </Text>
      <Text style={styles.stepDescription}>
        Type: {inspection.inspection_type}
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
  const selectedId = payload.selected_property_id || inspection.property_id;
  
  // If property is already set and matches, just show it
  if (property && selectedId === property.id) {
    return (
      <View>
        <Text style={styles.stepTitle}>Property Selected</Text>
        <Text style={styles.stepDescription}>
          {property.nickname || property.address_free_text}
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
        <Text style={styles.stepTitle}>Select Property</Text>
        <Text style={styles.stepDescription}>
          Please select the property for this inspection.
        </Text>
        {properties.map((prop) => (
          <PRGButton
            key={prop.id}
            title={prop.nickname || prop.address_free_text}
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
      <Text style={styles.stepTitle}>Property</Text>
      <Text style={styles.stepDescription}>
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

function ConfirmScopeStep({
  spaces,
  payload,
  onContinue,
  saving,
}: {
  spaces: Space[];
  payload: any;
  onContinue: (spaceIds: string[]) => void;
  saving: boolean;
}) {
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(
    payload.space_ids_in_scope || spaces.map((s) => s.id)
  );

  const toggleSpace = (spaceId: string) => {
    if (selectedSpaces.includes(spaceId)) {
      setSelectedSpaces(selectedSpaces.filter((id) => id !== spaceId));
    } else {
      setSelectedSpaces([...selectedSpaces, spaceId]);
    }
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Confirm Scope</Text>
      <Text style={styles.stepDescription}>
        Select which spaces to include in this inspection.
      </Text>
      {spaces.map((space) => (
        <PRGButton
          key={space.id}
          title={space.display_name}
          onPress={() => toggleSpace(space.id)}
          variant={selectedSpaces.includes(space.id) ? 'primary' : 'secondary'}
          style={styles.spaceButton}
        />
      ))}
      <PRGButton
        title="Continue"
        onPress={() => onContinue(selectedSpaces)}
        variant="primary"
        loading={saving}
        disabled={selectedSpaces.length === 0}
        style={styles.continueButton}
      />
    </View>
  );
}

function CaptureOverviewStep({
  property,
  payload,
  onContinue,
  saving,
}: {
  property: Property | null;
  payload: any;
  onContinue: (photoIds: string[]) => void;
  saving: boolean;
}) {
  const { showToast } = useToast();
  const [photoIds, setPhotoIds] = useState<string[]>(payload.photo_ids || []);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ filename: string; status: 'uploading' | 'success' | 'error' }[]>([]);

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

    if (!result.canceled && result.assets) {
      await uploadPhotos(result.assets);
    }
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
      const newPhotoIds: string[] = [];

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];

        try {
          // Process image (handles HEIC conversion and base64 conversion)
          const processed = await processImageForUpload(asset);

          const file = {
            base64: processed.base64,
            type: processed.mimeType,
            name: processed.fileName,
          };

          // Upload file and get file ID
          const fileId = await photosService.uploadFile(file);

          // Create photo metadata
          const photoData = {
            property: property.id,
            file: fileId,
            captured_at: asset.exif?.DateTimeOriginal
              ? new Date(asset.exif.DateTimeOriginal).toISOString()
              : new Date().toISOString(),
          };

          const photo = await photosService.createPhoto(photoData);
          newPhotoIds.push(photo.id);

          // Update status
          setUploadStatus(prev =>
            prev.map((status, idx) =>
              idx === i ? { ...status, status: 'success' } : status
            )
          );
        } catch (error) {
          console.error('Error uploading photo:', error);
          setUploadStatus(prev =>
            prev.map((status, idx) =>
              idx === i ? { ...status, status: 'error' } : status
            )
          );
        }
      }

      // Update photo IDs list
      setPhotoIds(prev => [...prev, ...newPhotoIds]);
      showToast(`${newPhotoIds.length} photo(s) uploaded`, 'success');
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
      <Text style={styles.stepTitle}>Capture Overview Photos</Text>
      <Text style={styles.stepDescription}>
        Take photos of the property entry, exterior, and key areas.
      </Text>

      <PRGButton
        title="Pick from Library"
        onPress={handlePickImages}
        disabled={uploading || saving}
        variant="secondary"
        style={styles.uploadButton}
      />

      <PRGButton
        title="Take Photo"
        onPress={handleTakePhoto}
        disabled={uploading || saving}
        variant="secondary"
        style={styles.uploadButton}
      />

      {photoIds.length > 0 && (
        <View style={styles.photoCountContainer}>
          <Text style={styles.photoCountText}>
            {photoIds.length} photo{photoIds.length !== 1 ? 's' : ''} uploaded
          </Text>
        </View>
      )}

      {uploadStatus.length > 0 && (
        <View style={styles.uploadList}>
          {uploadStatus.map((status, index) => (
            <View key={index} style={styles.uploadItem}>
              <Text style={styles.uploadFilename}>{status.filename}</Text>
              {status.status === 'uploading' && (
                <Text style={styles.uploadStatus}>Uploading...</Text>
              )}
              {status.status === 'success' && (
                <Text style={styles.successText}>✓ Uploaded</Text>
              )}
              {status.status === 'error' && (
                <Text style={styles.errorText}>✗ Failed</Text>
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
        disabled={uploading}
        style={styles.continueButton}
      />
    </View>
  );
}

function CaptureSpacesStep({
  property,
  spaces,
  payload,
  onContinue,
  saving,
}: {
  property: Property | null;
  spaces: Space[];
  payload: any;
  onContinue: (spaceData: any) => void;
  saving: boolean;
}) {
  const { showToast } = useToast();
  const [spacesData, setSpacesData] = useState<{ [spaceId: string]: { photo_ids: string[] } }>(
    payload.spaces_data || {}
  );
  const [uploadingSpaceId, setUploadingSpaceId] = useState<string | null>(null);

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

  const handlePickImages = async (space: Space, propertyId: string) => {
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
      await uploadPhotosForSpace(space, propertyId, result.assets);
    }
  };

  const handleTakePhoto = async (space: Space, propertyId: string) => {
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

    if (!result.canceled && result.assets) {
      await uploadPhotosForSpace(space, propertyId, result.assets);
    }
  };

  const uploadPhotosForSpace = async (space: Space, propertyId: string, assets: ImagePickerAsset[]) => {
    setUploadingSpaceId(space.id);

    try {
      const newPhotoIds: string[] = [];

      for (const asset of assets) {
        try {
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
            property: propertyId,
            file: fileId,
            space: space.id,
            assignment_status: 'confirmed',
            captured_at: asset.exif?.DateTimeOriginal
              ? new Date(asset.exif.DateTimeOriginal).toISOString()
              : new Date().toISOString(),
          };

          const photo = await photosService.createPhoto(photoData);
          newPhotoIds.push(photo.id);
        } catch (error) {
          console.error('Error uploading photo:', error);
        }
      }

      // Update spaces data
      setSpacesData(prev => ({
        ...prev,
        [space.id]: {
          photo_ids: [...(prev[space.id]?.photo_ids || []), ...newPhotoIds],
        },
      }));

      if (newPhotoIds.length > 0) {
        showToast(`${newPhotoIds.length} photo(s) uploaded for ${space.display_name}`, 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload photos', 'error');
    } finally {
      setUploadingSpaceId(null);
    }
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Capture Space Photos</Text>
      <Text style={styles.stepDescription}>
        Add photos for each space included in the inspection.
      </Text>

      {spaces.map((space) => {
        const spacePhotoIds = spacesData[space.id]?.photo_ids || [];
        const isUploading = uploadingSpaceId === space.id;

        return (
          <View key={space.id} style={styles.spacePhotoItem}>
            <Text style={styles.spaceName}>{space.display_name}</Text>
            <Text style={styles.spacePhotoCount}>
              {spacePhotoIds.length} photo{spacePhotoIds.length !== 1 ? 's' : ''}
            </Text>

            {property ? (
              <>
                <PRGButton
                  title="Pick from Library"
                  onPress={() => handlePickImages(space, property.id)}
                  disabled={isUploading || saving}
                  variant="secondary"
                  style={styles.spaceUploadButton}
                />
                <PRGButton
                  title="Take Photo"
                  onPress={() => handleTakePhoto(space, property.id)}
                  disabled={isUploading || saving}
                  variant="secondary"
                  style={styles.spaceUploadButton}
                />
              </>
            ) : (
              <Text style={styles.stepNote}>Property not loaded</Text>
            )}

            {isUploading && (
              <Text style={styles.uploadingText}>Uploading...</Text>
            )}
          </View>
        );
      })}

      <PRGButton
        title="Continue"
        onPress={() => onContinue(spacesData)}
        variant="primary"
        loading={saving}
        disabled={uploadingSpaceId !== null}
        style={styles.continueButton}
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
  payload: any;
  onContinue: (notes: string) => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(payload.user_summary_notes || '');

  const overviewPhotoCount = payload.photo_ids?.length || 0;
  const spacesData = payload.spaces_data || {};
  const totalSpacePhotos = Object.values(spacesData).reduce(
    (sum: number, spaceData: any) => sum + (spaceData.photo_ids?.length || 0),
    0
  );

  return (
    <View>
      <Text style={styles.stepTitle}>Review</Text>
      <Text style={styles.stepDescription}>
        Review your inspection details and add any final notes.
      </Text>
      <Text style={styles.reviewItem}>
        Property: {property?.nickname || property?.address_free_text}
      </Text>
      <Text style={styles.reviewItem}>
        Spaces: {spaces.length}
      </Text>
      <Text style={styles.reviewItem}>
        Overview Photos: {overviewPhotoCount}
      </Text>
      <Text style={styles.reviewItem}>
        Space Photos: {totalSpacePhotos}
      </Text>
      {spaces.length > 0 && (
        <View style={styles.spaceReviewList}>
          {spaces.map((space) => {
            const spacePhotoCount = spacesData[space.id]?.photo_ids?.length || 0;
            return (
              <Text key={space.id} style={styles.spaceReviewItem}>
                {space.display_name}: {spacePhotoCount} photo{spacePhotoCount !== 1 ? 's' : ''}
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
  return (
    <View>
      <Text style={styles.stepTitle}>Inspection Complete!</Text>
      <Text style={styles.stepDescription}>
        Your inspection has been completed successfully.
      </Text>
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
    backgroundColor: colors.gray[50],
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
    backgroundColor: colors.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
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
    color: colors.dark,
    marginBottom: spacing.md,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  stepNote: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  propertyButton: {
    marginBottom: spacing.sm,
  },
  spaceItem: {
    padding: spacing.md,
    backgroundColor: colors.light,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  spaceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark,
  },
  spaceNote: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  reviewItem: {
    fontSize: typography.fontSize.base,
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  notesInput: {
    marginTop: spacing.md,
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
  photoCountContainer: {
    padding: spacing.md,
    backgroundColor: colors.light,
    borderRadius: 8,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  photoCountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark,
    textAlign: 'center',
  },
  uploadList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  uploadItem: {
    padding: spacing.sm,
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  uploadFilename: {
    fontSize: typography.fontSize.sm,
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  uploadStatus: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
  },
  successText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  spacePhotoItem: {
    padding: spacing.md,
    backgroundColor: colors.light,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  spacePhotoCount: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    marginBottom: spacing.sm,
  },
  spaceUploadButton: {
    marginBottom: spacing.sm,
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  spaceReviewList: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: 8,
  },
  spaceReviewItem: {
    fontSize: typography.fontSize.sm,
    color: colors.dark,
    marginBottom: spacing.xs,
  },
});

