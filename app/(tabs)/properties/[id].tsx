import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { PRGTabBar, PRGHeader, WebPageFrame, useToast } from '../../../src/components';
import { useProperty } from '../../../src/hooks/usePropertiesQuery';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { PropertyOverview } from '../../../src/screens/PropertyOverview';
import { PropertySpaces } from '../../../src/screens/PropertySpaces';
import { PropertyPhotos } from '../../../src/screens/PropertyPhotos';
import { PropertyReport } from '../../../src/screens/PropertyReport';
import { canEditProperty } from '../../../src/utils/propertyAccess';
import {
  propertyDisplayName,
  formatPropertyAddress,
} from '../../../src/constants/propertyStatuses';
import {
  openApplicationPdf,
  pickApplicationPdf,
  promptAttachApplicationPdf,
  uploadApplicationPdf,
} from '../../../src/services/applicationDocumentService';
import { Routes } from '../../../src/navigation/routes';
import {
  goBackSkippingPropertiesIndex,
  hubHrefForPropertyStatus,
} from '../../../src/navigation/goBackOr';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'photos', label: 'Photos' },
  { id: 'report', label: 'Report' },
];

export default function PropertyDashboardScreen() {
  const { id, editTour } = useLocalSearchParams<{ id: string; editTour?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { data: property, isInitialLoading, error } = useProperty(
    typeof id === 'string' ? id : undefined
  );
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const deleteProperty = usePropertiesStore((s) => s.deleteProperty);
  const [activeTab, setActiveTab] = useState('overview');
  const [deleting, setDeleting] = useState(false);
  const [markingApplied, setMarkingApplied] = useState(false);
  const [attachingApplication, setAttachingApplication] = useState(false);
  // Capture once so clearing the query param does not close the editor.
  const [startEditingTour] = useState(
    () => editTour === '1' || editTour === 'true' || editTour === 'yes'
  );

  useEffect(() => {
    if (!startEditingTour) return;
    router.setParams({ editTour: undefined });
  }, [startEditingTour, router]);

  const handleBack = () => {
    goBackSkippingPropertiesIndex(
      router,
      navigation,
      hubHrefForPropertyStatus(property?.status)
    );
  };

  const handleUpdateNickname = async (newNickname: string) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, { nickname: newNickname });
      showToast('Nickname updated', 'success');
    } catch (err) {
      console.error('Error updating nickname:', err);
      showToast('Failed to update nickname', 'error');
    }
  };

  const handleUpdateListingUrl = async (listingUrl: string) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, {
        listing_url: listingUrl.trim() || null,
      });
      showToast('Property link updated', 'success');
    } catch (err) {
      console.error('Error updating listing URL:', err);
      showToast('Failed to update property link', 'error');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id || !property) return;
    const next = newStatus.toLowerCase();
    if (next === 'applied' && property.status?.toLowerCase() !== 'applied') {
      await handleMarkApplied();
      return;
    }
    try {
      await updateProperty(id, { status: newStatus });
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Failed to update status', 'error');
    }
  };

  const handleMarkApplied = async () => {
    if (!id || !property || markingApplied) return;
    const choice = await promptAttachApplicationPdf();
    if (choice === 'cancel') return;

    // Pick PDF before showing "Updating…" so the button isn't stuck during the picker.
    let uploaded: { fileId: string; fileName: string } | null = null;
    if (choice === 'attach') {
      try {
        const picked = await pickApplicationPdf();
        if (picked) {
          setMarkingApplied(true);
          try {
            uploaded = await uploadApplicationPdf(id, picked);
          } catch (uploadErr) {
            console.error('Error uploading application PDF:', uploadErr);
            showToast(
              uploadErr instanceof Error
                ? uploadErr.message
                : 'Could not upload PDF — you can attach it below',
              'error'
            );
            setMarkingApplied(false);
            return;
          }
        }
      } catch (pickErr) {
        console.error('Error picking application PDF:', pickErr);
        showToast(
          pickErr instanceof Error ? pickErr.message : 'Could not open PDF picker',
          'error'
        );
      }
    }

    setMarkingApplied(true);
    try {
      const updates: {
        status: 'applied';
        application_file?: string;
        application_file_name?: string;
      } = { status: 'applied' };
      if (uploaded) {
        updates.application_file = uploaded.fileId;
        updates.application_file_name = uploaded.fileName;
      }

      await updateProperty(id, updates);
      showToast(
        updates.application_file
          ? 'Marked as Applied with application PDF'
          : 'Marked as Applied',
        'success'
      );
    } catch (err) {
      console.error('Error marking property as applied:', err);
      showToast('Failed to update status', 'error');
    } finally {
      setMarkingApplied(false);
    }
  };

  const handleOpenApplication = async () => {
    if (!property?.application_file) return;
    try {
      await openApplicationPdf(
        property.application_file,
        property.application_file_name
      );
    } catch (err) {
      console.error('Error opening application PDF:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to open application PDF',
        'error'
      );
    }
  };

  const handleAttachApplication = async () => {
    if (!id || !property || attachingApplication) return;
    try {
      const picked = await pickApplicationPdf();
      if (!picked) return;
      setAttachingApplication(true);
      const uploaded = await uploadApplicationPdf(id, picked);
      await updateProperty(id, {
        application_file: uploaded.fileId,
        application_file_name: uploaded.fileName,
      });
      showToast('Application PDF saved', 'success');
    } catch (err) {
      console.error('Error attaching application PDF:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to attach application PDF',
        'error'
      );
    } finally {
      setAttachingApplication(false);
    }
  };

  const handleUpdateLeaseStart = async (leaseStart: string) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, { lease_start_date: leaseStart });
      showToast('Lease start date updated', 'success');
    } catch (err) {
      console.error('Error updating lease start:', err);
      showToast('Failed to update lease start date', 'error');
    }
  };

  const handleUpdateLeaseEnd = async (leaseEnd: string | null) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, { lease_end_date: leaseEnd });
      showToast(
        leaseEnd ? 'Lease end date updated' : 'Lease end date cleared',
        'success'
      );
    } catch (err) {
      console.error('Error updating lease end:', err);
      showToast('Failed to update lease end date', 'error');
    }
  };

  const handleUpdateLeaseTerm = async (leaseTerm: number | null) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, {
        lease_term: leaseTerm,
      } as { lease_term?: number | null });
      showToast('Lease term updated', 'success');
    } catch (err) {
      console.error('Error updating lease term:', err);
      showToast('Failed to update lease term', 'error');
    }
  };

  const handleUpdateTourScheduledAt = async (tourScheduledAt: string | null) => {
    if (!id || !property) return;
    try {
      await updateProperty(id, { tour_scheduled_at: tourScheduledAt });
      showToast(
        tourScheduledAt ? 'Tour time updated' : 'Tour time cleared',
        'success'
      );
    } catch (err) {
      console.error('Error updating tour time:', err);
      showToast('Failed to update tour time', 'error');
    }
  };

  const handleMarkToured = async () => {
    if (!id || !property) return;
    try {
      await updateProperty(id, {
        tour_completed_at: new Date().toISOString(),
        tour_completed_source: 'confirmed',
      });
      showToast('Marked as toured', 'success');
    } catch (err) {
      console.error('Error marking toured:', err);
      showToast('Failed to mark as toured', 'error');
    }
  };

  const handleDelete = async () => {
    if (!id || deleting) return;
    try {
      setDeleting(true);
      await deleteProperty(id);
      showToast('Property deleted successfully', 'success');
      router.replace(hubHrefForPropertyStatus(property?.status) as never);
    } catch (err) {
      console.error('[PropertyDashboardScreen] Error deleting property:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete property';
      showToast(errorMessage, 'error');
      setDeleting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Property" showBack onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading…
          </Text>
        </View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Property Not Found" showBack onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error || 'Property not found'}
          </Text>
        </View>
      </View>
    );
  }

  const myRole = property.my_role || 'owner';
  const canEdit = canEditProperty(property);
  const canDelete = myRole === 'owner';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <PropertyOverview
            property={property}
            onUpdateNickname={canEdit ? handleUpdateNickname : undefined}
            onUpdateListingUrl={canEdit ? handleUpdateListingUrl : undefined}
            onUpdateStatus={canEdit ? handleUpdateStatus : undefined}
            onUpdateLeaseStart={canEdit ? handleUpdateLeaseStart : undefined}
            onUpdateLeaseEnd={canEdit ? handleUpdateLeaseEnd : undefined}
            onUpdateLeaseTerm={canEdit ? handleUpdateLeaseTerm : undefined}
            onUpdateTourScheduledAt={canEdit ? handleUpdateTourScheduledAt : undefined}
            onMarkToured={canEdit ? handleMarkToured : undefined}
            onMarkApplied={canEdit ? handleMarkApplied : undefined}
            onOpenApplication={
              property.application_file ? handleOpenApplication : undefined
            }
            onAttachApplication={canEdit ? handleAttachApplication : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            deleting={deleting}
            markingApplied={markingApplied}
            attachingApplication={attachingApplication}
            initialEditingTour={startEditingTour && canEdit}
            onManagePeople={() =>
              router.push(`/(tabs)/properties/${property.id}/people`)
            }
          />
        );
      case 'spaces':
        return <PropertySpaces propertyId={property.id} canEdit={canEdit} />;
      case 'photos':
        return <PropertyPhotos propertyId={property.id} canEdit={canEdit} />;
      case 'report':
        return <PropertyReport propertyId={property.id} />;
      default:
        return (
          <PropertyOverview
            property={property}
            onUpdateNickname={canEdit ? handleUpdateNickname : undefined}
            onUpdateListingUrl={canEdit ? handleUpdateListingUrl : undefined}
            onUpdateStatus={canEdit ? handleUpdateStatus : undefined}
            onUpdateLeaseStart={canEdit ? handleUpdateLeaseStart : undefined}
            onUpdateLeaseEnd={canEdit ? handleUpdateLeaseEnd : undefined}
            onUpdateLeaseTerm={canEdit ? handleUpdateLeaseTerm : undefined}
            onUpdateTourScheduledAt={canEdit ? handleUpdateTourScheduledAt : undefined}
            onMarkToured={canEdit ? handleMarkToured : undefined}
            onMarkApplied={canEdit ? handleMarkApplied : undefined}
            onOpenApplication={
              property.application_file ? handleOpenApplication : undefined
            }
            onAttachApplication={canEdit ? handleAttachApplication : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            deleting={deleting}
            markingApplied={markingApplied}
            attachingApplication={attachingApplication}
            initialEditingTour={startEditingTour && canEdit}
            onManagePeople={() =>
              router.push(`/(tabs)/properties/${property.id}/people`)
            }
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title={propertyDisplayName(property)}
        subtitle={formatPropertyAddress(property) || undefined}
        showBack
        onBack={handleBack}
      />
      <PRGTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <WebPageFrame>
        <View style={styles.content}>{renderTabContent()}</View>
      </WebPageFrame>
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
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
  },
  content: {
    flex: 1,
  },
});
