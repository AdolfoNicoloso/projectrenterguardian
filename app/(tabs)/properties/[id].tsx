import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGTabBar, PRGHeader, useToast } from '../../../src/components';
import { useProperty } from '../../../src/hooks/usePropertiesQuery';
import { usePropertiesStore } from '../../../src/state/propertiesStore';
import { colors, spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { PropertyOverview } from '../../../src/screens/PropertyOverview';
import { PropertySpaces } from '../../../src/screens/PropertySpaces';
import { PropertyPhotos } from '../../../src/screens/PropertyPhotos';
import { PropertyReport } from '../../../src/screens/PropertyReport';
import { canEditProperty } from '../../../src/utils/propertyAccess';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'photos', label: 'Photos' },
  { id: 'report', label: 'Report' },
];

export default function PropertyDashboardScreen() {
  const { id, editTour } = useLocalSearchParams<{ id: string; editTour?: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { colors: themeColors } = useTheme();
  const { data: property, isInitialLoading, error } = useProperty(
    typeof id === 'string' ? id : undefined
  );
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const deleteProperty = usePropertiesStore((s) => s.deleteProperty);
  const [activeTab, setActiveTab] = useState('overview');
  const [deleting, setDeleting] = useState(false);
  // Capture once so clearing the query param does not close the editor.
  const [startEditingTour] = useState(
    () => editTour === '1' || editTour === 'true' || editTour === 'yes'
  );

  useEffect(() => {
    if (!startEditingTour) return;
    router.setParams({ editTour: undefined });
  }, [startEditingTour, router]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)/properties');
    }
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
    try {
      await updateProperty(id, { status: newStatus });
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Failed to update status', 'error');
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

  const handleDelete = async () => {
    if (!id || deleting) return;
    try {
      setDeleting(true);
      await deleteProperty(id);
      showToast('Property deleted successfully', 'success');
      router.replace('/(tabs)/properties');
    } catch (err) {
      console.error('[PropertyDashboardScreen] Error deleting property:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete property';
      showToast(errorMessage, 'error');
      setDeleting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <PRGHeader title="Property" showBack onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading…
          </Text>
        </View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <PRGHeader title="Property Not Found" showBack onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
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
            onUpdateLeaseTerm={canEdit ? handleUpdateLeaseTerm : undefined}
            onUpdateTourScheduledAt={canEdit ? handleUpdateTourScheduledAt : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            deleting={deleting}
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
            onUpdateLeaseTerm={canEdit ? handleUpdateLeaseTerm : undefined}
            onUpdateTourScheduledAt={canEdit ? handleUpdateTourScheduledAt : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            deleting={deleting}
            initialEditingTour={startEditingTour && canEdit}
            onManagePeople={() =>
              router.push(`/(tabs)/properties/${property.id}/people`)
            }
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <PRGHeader
        title={property.nickname || property.address_free_text}
        subtitle={property.nickname ? property.address_free_text : undefined}
        showBack
        onBack={handleBack}
      />
      <PRGTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <View style={styles.content}>{renderTabContent()}</View>
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
