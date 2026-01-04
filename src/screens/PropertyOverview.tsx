import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRGCard, PRGEditableTextRow, PRGButton, DateField, NumberPicker } from '../components';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { formatDisplayDate } from '../utils/directusDate';
import { Routes } from '../navigation/routes';
import type { Property } from '../types';

interface PropertyOverviewProps {
  property: Property;
  onUpdateNickname?: (nickname: string) => void;
  onUpdateStatus?: (status: string) => void;
  onUpdateLeaseStart?: (leaseStart: string) => void;
  onUpdateLeaseTerm?: (leaseTerm: number | null) => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export const PropertyOverview: React.FC<PropertyOverviewProps> = ({ 
  property, 
  onUpdateNickname,
  onUpdateStatus,
  onUpdateLeaseStart,
  onUpdateLeaseTerm,
  onDelete,
  deleting = false,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showLeaseStartModal, setShowLeaseStartModal] = useState(false);
  const [showLeaseTermModal, setShowLeaseTermModal] = useState(false);
  const [editLeaseStart, setEditLeaseStart] = useState<string | null>(property.lease_start_date || null);
  const [editLeaseTerm, setEditLeaseTerm] = useState<number | null>(property.lease_term || null);

  const getStatusLabel = (status?: string) => {
    if (!status) return 'N/A';
    const normalized = status.toLowerCase();
    if (normalized === 'active') return 'Active';
    if (normalized === 'draft') return 'Draft';
    if (normalized === 'archived') return 'Archived';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const isLeaseExpired = () => {
    if (!property.lease_end_date) return false;
    const endDate = new Date(property.lease_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return endDate <= today;
  };

  const showDraftButton = property.status?.toLowerCase() === 'draft';
  const showArchiveButton = 
    property.status?.toLowerCase() === 'active' && isLeaseExpired();

  const handleLeaseStartSave = () => {
    if (onUpdateLeaseStart && editLeaseStart) {
      onUpdateLeaseStart(editLeaseStart);
    }
    setShowLeaseStartModal(false);
  };

  const handleLeaseStartCancel = () => {
    setEditLeaseStart(property.lease_start_date || null);
    setShowLeaseStartModal(false);
  };

  const handleLeaseTermSave = () => {
    if (onUpdateLeaseTerm !== undefined) {
      onUpdateLeaseTerm(editLeaseTerm);
    }
    setShowLeaseTermModal(false);
  };

  const handleLeaseTermCancel = () => {
    setEditLeaseTerm(property.lease_term || null);
    setShowLeaseTermModal(false);
  };

  const handleLeaseStartPress = () => {
    if (onUpdateLeaseStart) {
      setEditLeaseStart(property.lease_start_date || null);
      setShowLeaseStartModal(true);
    }
  };

  const handleLeaseTermPress = () => {
    if (onUpdateLeaseTerm !== undefined) {
      setEditLeaseTerm(property.lease_term || null);
      setShowLeaseTermModal(true);
    }
  };

  // Sync edit states when property changes
  useEffect(() => {
    setEditLeaseStart(property.lease_start_date || null);
    setEditLeaseTerm(property.lease_term || null);
  }, [property.lease_start_date, property.lease_term]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <PRGCard>
        <PRGEditableTextRow
          label="Nickname"
          value={property.nickname ?? ''}
          onSave={(value) => onUpdateNickname?.(value)}
          placeholder="Add a nickname for this property"
          editable={!!onUpdateNickname}
        />
      </PRGCard>

      <PRGCard onPress={() => router.push(Routes.PROPERTIES.ADDRESS.EDIT(property.id))}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>{property.address_free_text}</Text>
          <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
        </View>
      </PRGCard>

      <PRGCard onPress={onUpdateLeaseStart ? handleLeaseStartPress : undefined}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Lease Start</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
            {formatDisplayDate(property.lease_start_date) || 'N/A'}
          </Text>
          {onUpdateLeaseStart && (
            <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
          )}
        </View>
      </PRGCard>

      <PRGCard onPress={onUpdateLeaseTerm !== undefined ? handleLeaseTermPress : undefined}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Term Length</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
            {property.lease_term 
              ? (property.lease_term === 0 ? 'Month-by-month' : property.lease_term === 1 ? '1 month' : `${property.lease_term} months`)
              : 'N/A'}
          </Text>
          {onUpdateLeaseTerm !== undefined && (
            <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
          )}
        </View>
      </PRGCard>

      {showLeaseStartModal && (
        <Modal
          transparent
          visible={showLeaseStartModal}
          animationType="slide"
          onRequestClose={handleLeaseStartCancel}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleLeaseStartCancel}
          >
            <View 
              style={[
                styles.modalContent, 
                { 
                  backgroundColor: colors.card,
                  paddingBottom: insets.bottom + spacing.md,
                }
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleLeaseStartCancel}>
                  <Text style={[styles.modalButton, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Lease Start</Text>
                <TouchableOpacity onPress={handleLeaseStartSave}>
                  <Text style={[styles.modalButton, { color: colors.primary }]}>Save</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <DateField
                  label="Lease Start Date"
                  valueISO={editLeaseStart}
                  onChangeISO={setEditLeaseStart}
                  dateOnly={true}
                  placeholder="Select lease start date"
                />
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showLeaseTermModal && (
        <Modal
          transparent
          visible={showLeaseTermModal}
          animationType="slide"
          onRequestClose={handleLeaseTermCancel}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleLeaseTermCancel}
          >
            <View 
              style={[
                styles.modalContent, 
                { 
                  backgroundColor: colors.card,
                  paddingBottom: insets.bottom + spacing.md,
                }
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleLeaseTermCancel}>
                  <Text style={[styles.modalButton, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Term Length</Text>
                <TouchableOpacity onPress={handleLeaseTermSave}>
                  <Text style={[styles.modalButton, { color: colors.primary }]}>Save</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <NumberPicker
                  label="Lease Term (months)"
                  value={editLeaseTerm}
                  onChange={setEditLeaseTerm}
                  min={1}
                  max={36}
                  placeholder="Select number of months"
                />
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {property.lease_end_date && (
        <PRGCard>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Lease End</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatDisplayDate(property.lease_end_date) || 'N/A'}
          </Text>
        </PRGCard>
      )}

      {property.state_code && (
        <PRGCard>
          <Text style={[styles.label, { color: colors.textSecondary }]}>State</Text>
          <Text style={[styles.value, { color: colors.text }]}>{property.state_code}</Text>
        </PRGCard>
      )}

      <PRGCard>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
        <Text style={[styles.value, { color: colors.text }]}>{getStatusLabel(property.status)}</Text>
      </PRGCard>

      <View style={styles.actionContainer}>
        <PRGButton
          title="Start Inspection"
          onPress={() => router.push(`/(tabs)/inspections/new?propertyId=${property.id}`)}
          variant="primary"
          style={styles.actionButton}
        />
      </View>

      {(showDraftButton || showArchiveButton) && (
        <View style={styles.actionContainer}>
          <PRGButton
            title={showDraftButton ? 'Signed the lease?' : 'Done moving out?'}
            onPress={() => {
              if (showDraftButton && onUpdateStatus) {
                onUpdateStatus('active');
              } else if (showArchiveButton && onUpdateStatus) {
                onUpdateStatus('archived');
              }
            }}
            variant="primary"
            style={styles.actionButton}
          />
        </View>
      )}

      {onDelete && (
        <View style={styles.deleteContainer}>
          <PRGButton
            title="Delete Property"
            onPress={() => {
              if (deleting) {
                // Prevent multiple deletion attempts
                return;
              }
              
              console.log('[PropertyOverview] Delete button pressed');
              
              // Use window.confirm on web as Alert.alert may not work
              if (Platform.OS === 'web') {
                const confirmed = (window as any).confirm(
                  `Are you sure you want to delete "${property.nickname || property.address_free_text}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`
                );
                if (confirmed) {
                  console.log('[PropertyOverview] Delete confirmed (web), calling onDelete');
                  onDelete();
                } else {
                  console.log('[PropertyOverview] Delete cancelled (web)');
                }
              } else {
                Alert.alert(
                  'Delete Property',
                  `Are you sure you want to delete "${property.nickname || property.address_free_text}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`,
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                      onPress: () => console.log('[PropertyOverview] Delete cancelled'),
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        console.log('[PropertyOverview] Delete confirmed, calling onDelete');
                        onDelete();
                      },
                    },
                  ],
                  { cancelable: true }
                );
              }
            }}
            variant="ghost"
            textColor={colors.error}
            style={styles.deleteButton}
            loading={deleting}
            disabled={deleting}
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  valueFlex: {
    flex: 1,
    marginRight: spacing.sm,
  },
  editHint: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },
  actionContainer: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  actionButton: {
    width: '100%',
  },
  deleteContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  deleteButton: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  modalBody: {
    padding: spacing.lg,
  },
});


