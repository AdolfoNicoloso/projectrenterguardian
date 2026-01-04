import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PRGTabBar, PRGHeader, useToast } from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { colors, spacing, typography } from '../../../src/theme';
import type { Property } from '../../../src/types';
import { PropertyOverview } from '../../../src/screens/PropertyOverview';
import { PropertySpaces } from '../../../src/screens/PropertySpaces';
import { PropertyPhotos } from '../../../src/screens/PropertyPhotos';
import { PropertyReport } from '../../../src/screens/PropertyReport';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'photos', label: 'Photos' },
  { id: 'report', label: 'Report' },
];

export default function PropertyDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadProperty = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await propertiesService.getProperty(id);
      setProperty(data);
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProperty();
  }, [loadProperty]);

  // Refetch property data when screen comes into focus
  // This ensures we see the latest data after navigating back from edit screens
  useFocusEffect(
    useCallback(() => {
      loadProperty();
    }, [loadProperty])
  );

  if (loading || !property) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handleUpdateNickname = async (newNickname: string) => {
    if (!id || !property) return;
    try {
      const updated = await propertiesService.updateProperty(id, { nickname: newNickname });
      setProperty(updated);
      showToast('Nickname updated', 'success');
    } catch (error) {
      console.error('Error updating nickname:', error);
      showToast('Failed to update nickname', 'error');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id || !property) return;
    try {
      const updated = await propertiesService.updateProperty(id, { status: newStatus });
      setProperty(updated);
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const handleUpdateLeaseStart = async (leaseStart: string) => {
    if (!id || !property) return;
    try {
      const updated = await propertiesService.updateProperty(id, { lease_start_date: leaseStart });
      setProperty(updated);
      showToast('Lease start date updated', 'success');
    } catch (error) {
      console.error('Error updating lease start:', error);
      showToast('Failed to update lease start date', 'error');
    }
  };

  const handleUpdateLeaseTerm = async (leaseTerm: number | null) => {
    if (!id || !property) return;
    try {
      const updated = await propertiesService.updateProperty(id, { lease_term: leaseTerm || undefined });
      setProperty(updated);
      showToast('Lease term updated', 'success');
    } catch (error) {
      console.error('Error updating lease term:', error);
      showToast('Failed to update lease term', 'error');
    }
  };

  const handleDelete = async () => {
    console.log('[PropertyDashboardScreen] handleDelete called, id:', id);
    if (!id || deleting) {
      console.warn('[PropertyDashboardScreen] No id available for deletion or already deleting');
      return;
    }
    try {
      setDeleting(true);
      console.log('[PropertyDashboardScreen] Calling deleteProperty with id:', id);
      await propertiesService.deleteProperty(id);
      console.log('[PropertyDashboardScreen] Property deleted successfully');
      showToast('Property deleted successfully', 'success');
      // Navigate back to properties list - this will clean up any child routes
      router.replace('/(tabs)/properties');
    } catch (error) {
      console.error('[PropertyDashboardScreen] Error deleting property:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete property';
      showToast(errorMessage, 'error');
      setDeleting(false);
    }
  };

  const handleBack = () => {
    // Use native back navigation for proper iOS backward animation
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navigate to properties list if we can't go back
      router.push('/(tabs)/properties');
    }
  };

  const renderTabContent = () => {
    if (!property) return null;
    switch (activeTab) {
      case 'overview':
        return (
          <PropertyOverview 
            property={property} 
            onUpdateNickname={handleUpdateNickname}
            onUpdateStatus={handleUpdateStatus}
            onUpdateLeaseStart={handleUpdateLeaseStart}
            onUpdateLeaseTerm={handleUpdateLeaseTerm}
            onDelete={handleDelete}
            deleting={deleting}
          />
        );
      case 'spaces':
        return <PropertySpaces propertyId={property.id} />;
      case 'photos':
        return <PropertyPhotos propertyId={property.id} />;
      case 'report':
        return <PropertyReport propertyId={property.id} />;
      default:
        return (
          <PropertyOverview 
            property={property} 
            onUpdateNickname={handleUpdateNickname}
            onUpdateStatus={handleUpdateStatus}
            onUpdateLeaseStart={handleUpdateLeaseStart}
            onUpdateLeaseTerm={handleUpdateLeaseTerm}
            onDelete={handleDelete}
            deleting={deleting}
          />
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Property" showBack onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
    }

  if (!property) {
    return (
      <View style={styles.container}>
        <PRGHeader title="Property Not Found" showBack onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Property not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
  },
  content: {
    flex: 1,
  },
});



