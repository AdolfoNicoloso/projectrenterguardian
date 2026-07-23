import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PRGCard, PRGEditableTextRow, PRGButton, DateField, NumberPicker } from '../components';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { formatDisplayDate } from '../utils/cmsDateTime';
import { isValidOptionalHttpUrl } from '../utils/validation';
import { Routes } from '../navigation/routes';
import { PROPERTY_STATUSES, getPropertyStatusLabel, isActivePropertyStatus, isTouringPropertyStatus } from '../constants/propertyStatuses';
import { inspectionsService } from '../services/inspectionsService';
import type { Property } from '../types';

function formatLeaseTerm(term?: number | null): string {
  if (term === null || term === undefined) return 'N/A';
  if (term === 0) return 'Month-by-month';
  if (term === 1) return '1 month';
  return `${term} months`;
}

interface PropertyOverviewProps {
  property: Property;
  onUpdateNickname?: (nickname: string) => void;
  onUpdateListingUrl?: (listingUrl: string) => void;
  onUpdateStatus?: (status: string) => void;
  onUpdateLeaseStart?: (leaseStart: string) => void;
  onUpdateLeaseTerm?: (leaseTerm: number | null) => void;
  onUpdateTourScheduledAt?: (tourScheduledAt: string | null) => void;
  onDelete?: () => void;
  onManagePeople?: () => void;
  deleting?: boolean;
  /** When true, open the tour date/time editor on mount (deep-link from Home). */
  initialEditingTour?: boolean;
}

export const PropertyOverview: React.FC<PropertyOverviewProps> = ({
  property,
  onUpdateNickname,
  onUpdateListingUrl,
  onUpdateStatus,
  onUpdateLeaseStart,
  onUpdateLeaseTerm,
  onUpdateTourScheduledAt,
  onDelete,
  onManagePeople,
  deleting = false,
  initialEditingTour = false,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  const [editingLeaseStart, setEditingLeaseStart] = useState(false);
  const [editingLeaseTerm, setEditingLeaseTerm] = useState(false);
  const [editingTour, setEditingTour] = useState(
    () => initialEditingTour && isTouringPropertyStatus(property.status)
  );
  const [editingStatus, setEditingStatus] = useState(false);
  const [editLeaseStart, setEditLeaseStart] = useState<string | null>(
    property.lease_start_date || null
  );
  const [editLeaseTerm, setEditLeaseTerm] = useState<number | null>(
    property.lease_term ?? null
  );
  const [editTourAt, setEditTourAt] = useState<string | null>(
    property.tour_scheduled_at || null
  );
  const [incompleteTourId, setIncompleteTourId] = useState<string | null>(null);

  useEffect(() => {
    setEditLeaseStart(property.lease_start_date || null);
    setEditLeaseTerm(property.lease_term ?? null);
  }, [property.lease_start_date, property.lease_term]);

  useEffect(() => {
    setEditTourAt(property.tour_scheduled_at || null);
  }, [property.tour_scheduled_at]);

  const loadIncompleteTour = useCallback(async () => {
    if (!isTouringPropertyStatus(property.status)) {
      setIncompleteTourId(null);
      return;
    }
    try {
      const drafts = await inspectionsService.getMyInspections({
        status: 'in_progress',
      });
      const tourDrafts = drafts
        .filter(
          (d) =>
            d.property_id === property.id &&
            (d.inspection_type || '').toLowerCase() === 'tour'
        )
        .sort((a, b) => {
          const aTime = Date.parse(a.date_updated || a.started_at || '') || 0;
          const bTime = Date.parse(b.date_updated || b.started_at || '') || 0;
          return bTime - aTime;
        });
      setIncompleteTourId(tourDrafts[0]?.id ?? null);
    } catch (err) {
      console.error('Error loading incomplete tour for property:', err);
      setIncompleteTourId(null);
    }
  }, [property.id, property.status]);

  useFocusEffect(
    useCallback(() => {
      void loadIncompleteTour();
    }, [loadIncompleteTour])
  );

  const getStatusLabel = (status?: string) => getPropertyStatusLabel(status);

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
    isActivePropertyStatus(property.status) && isLeaseExpired();
  const isTouring = isTouringPropertyStatus(property.status);
  const canStartInspection =
    isActivePropertyStatus(property.status) || isTouring;

  const saveLeaseStart = () => {
    if (onUpdateLeaseStart && editLeaseStart) {
      onUpdateLeaseStart(editLeaseStart);
    }
    setEditingLeaseStart(false);
  };

  const cancelLeaseStart = () => {
    setEditLeaseStart(property.lease_start_date || null);
    setEditingLeaseStart(false);
  };

  const saveLeaseTerm = () => {
    if (onUpdateLeaseTerm !== undefined) {
      onUpdateLeaseTerm(editLeaseTerm);
    }
    setEditingLeaseTerm(false);
  };

  const cancelLeaseTerm = () => {
    setEditLeaseTerm(property.lease_term ?? null);
    setEditingLeaseTerm(false);
  };

  const saveTour = () => {
    onUpdateTourScheduledAt?.(editTourAt);
    setEditingTour(false);
  };

  const cancelTour = () => {
    setEditTourAt(property.tour_scheduled_at || null);
    setEditingTour(false);
  };

  const clearTour = () => {
    setEditTourAt(null);
    onUpdateTourScheduledAt?.(null);
    setEditingTour(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <PRGCard>
        <PRGEditableTextRow
          label="Nickname"
          value={property.nickname ?? ''}
          onSave={(value) => onUpdateNickname?.(value)}
          placeholder="Add a nickname for this property"
          editable={!!onUpdateNickname}
          allowEmpty
        />
      </PRGCard>

      <PRGCard onPress={() => router.push(Routes.PROPERTIES.ADDRESS.EDIT(property.id))}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
            {property.address_free_text}
          </Text>
          <Text style={[styles.editHint, { color: colors.primary }]}>Tap to edit</Text>
        </View>
      </PRGCard>

      <PRGCard>
        <PRGEditableTextRow
          label="Property Link"
          value={property.listing_url ?? ''}
          onSave={(value) => {
            if (!isValidOptionalHttpUrl(value)) {
              const message =
                'Property link must be a valid http:// or https:// URL, or left empty.';
              if (Platform.OS === 'web') {
                window.alert(message);
              } else {
                Alert.alert('Invalid link', message);
              }
              return;
            }
            onUpdateListingUrl?.(value.trim());
          }}
          placeholder="https://… (optional)"
          editable={!!onUpdateListingUrl}
          autoCapitalize="none"
          allowEmpty
        />
      </PRGCard>

      {isTouring ? (
        <PRGCard>
          {!editingTour ? (
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Tour date & time
              </Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                  {formatDisplayDate(property.tour_scheduled_at, 'datetime') ||
                    'Not scheduled'}
                </Text>
                {onUpdateTourScheduledAt ? (
                  <Text
                    style={[styles.editHint, { color: colors.primary }]}
                    onPress={() => {
                      setEditTourAt(property.tour_scheduled_at || null);
                      setEditingTour(true);
                      setEditingLeaseStart(false);
                      setEditingLeaseTerm(false);
                      setEditingStatus(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit tour date and time"
                  >
                    Tap to edit
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.helper, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Personal tracker only — not a booking with the landlord or management.
              </Text>
            </View>
          ) : (
            <View>
              <DateField
                label="Tour date & time"
                valueISO={editTourAt}
                onChangeISO={setEditTourAt}
                dateOnly={false}
                placeholder="Select date and time"
              />
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                Reminders go to everyone with access: 1 day before and 30 minutes before.
                This does not schedule with the landlord.
              </Text>
              <View style={styles.editActions}>
                <PRGButton
                  title="Clear"
                  onPress={clearTour}
                  variant="ghost"
                  style={styles.actionButton}
                />
                <PRGButton
                  title="Cancel"
                  onPress={cancelTour}
                  variant="ghost"
                  style={styles.actionButton}
                />
                <PRGButton
                  title="Save"
                  onPress={saveTour}
                  variant="primary"
                  style={styles.actionButton}
                  disabled={!editTourAt}
                />
              </View>
            </View>
          )}
        </PRGCard>
      ) : (
        <>
          <PRGCard>
            {!editingLeaseStart ? (
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Lease Start</Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                    {formatDisplayDate(property.lease_start_date) || 'N/A'}
                  </Text>
                  {onUpdateLeaseStart ? (
                    <Text
                      style={[styles.editHint, { color: colors.primary }]}
                      onPress={() => {
                        setEditLeaseStart(property.lease_start_date || null);
                        setEditingLeaseStart(true);
                        setEditingLeaseTerm(false);
                        setEditingTour(false);
                        setEditingStatus(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit lease start date"
                    >
                      Tap to edit
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View>
                <DateField
                  label="Lease Start Date"
                  valueISO={editLeaseStart}
                  onChangeISO={setEditLeaseStart}
                  dateOnly
                  placeholder="Select lease start date"
                />
                <View style={styles.editActions}>
                  <PRGButton title="Cancel" onPress={cancelLeaseStart} variant="ghost" style={styles.actionButton} />
                  <PRGButton
                    title="Save"
                    onPress={saveLeaseStart}
                    variant="primary"
                    style={styles.actionButton}
                    disabled={!editLeaseStart}
                  />
                </View>
              </View>
            )}
          </PRGCard>

          <PRGCard>
            {!editingLeaseTerm ? (
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Term Length</Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                    {formatLeaseTerm(property.lease_term)}
                  </Text>
                  {onUpdateLeaseTerm !== undefined ? (
                    <Text
                      style={[styles.editHint, { color: colors.primary }]}
                      onPress={() => {
                        setEditLeaseTerm(property.lease_term ?? null);
                        setEditingLeaseTerm(true);
                        setEditingLeaseStart(false);
                        setEditingTour(false);
                        setEditingStatus(false);
                      }}
                    >
                      Tap to edit
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View>
                <NumberPicker
                  label="Lease Term (months)"
                  value={editLeaseTerm}
                  onChange={setEditLeaseTerm}
                  min={1}
                  max={36}
                  placeholder="Select number of months"
                />
                <View style={styles.editActions}>
                  <PRGButton title="Cancel" onPress={cancelLeaseTerm} variant="ghost" style={styles.actionButton} />
                  <PRGButton title="Save" onPress={saveLeaseTerm} variant="primary" style={styles.actionButton} />
                </View>
              </View>
            )}
          </PRGCard>

          {property.lease_end_date ? (
            <PRGCard>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Lease End</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatDisplayDate(property.lease_end_date) || 'N/A'}
              </Text>
            </PRGCard>
          ) : null}
        </>
      )}

      <PRGCard>
        {!editingStatus ? (
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                {getStatusLabel(property.status)}
              </Text>
              {onUpdateStatus ? (
                <Text
                  style={[styles.editHint, { color: colors.primary }]}
                  onPress={() => {
                    setEditingStatus(true);
                    setEditingLeaseStart(false);
                    setEditingLeaseTerm(false);
                    setEditingTour(false);
                  }}
                >
                  Tap to edit
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Active properties can start any inspection. Touring properties can start a Tour.
            </Text>
            {PROPERTY_STATUSES.map((status) => (
              <PRGButton
                key={status.value}
                title={status.label}
                onPress={() => {
                  // Touring → Active needs lease; use convert flow.
                  if (
                    isTouring &&
                    status.value === 'active'
                  ) {
                    setEditingStatus(false);
                    router.push(`/(tabs)/properties/${property.id}/convert`);
                    return;
                  }
                  onUpdateStatus?.(status.value);
                  setEditingStatus(false);
                }}
                variant={
                  property.status?.toLowerCase() === status.value ? 'primary' : 'secondary'
                }
                style={styles.statusOption}
                accessibilityLabel={`Set status to ${status.label}`}
              />
            ))}
            <PRGButton
              title="Cancel"
              onPress={() => setEditingStatus(false)}
              variant="ghost"
              style={styles.actionButton}
            />
          </View>
        )}
      </PRGCard>

      {canStartInspection ? (
        <View style={styles.actionContainer}>
          <PRGButton
            title={
              isTouring
                ? incompleteTourId
                  ? 'Continue tour'
                  : 'Start Tour'
                : 'Start Inspection'
            }
            onPress={() => {
              if (isTouring && incompleteTourId) {
                router.push(`/(tabs)/inspections/${incompleteTourId}`);
                return;
              }
              router.push(
                isTouring
                  ? `/(tabs)/inspections/new?propertyId=${property.id}&inspectionType=tour`
                  : `/(tabs)/inspections/new?propertyId=${property.id}`
              );
            }}
            variant="primary"
            style={styles.actionButtonFull}
          />
        </View>
      ) : (
        <PRGCard style={styles.inactiveNotice}>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Set this property’s status to Active (or Touring for a viewing) to start an inspection.
          </Text>
        </PRGCard>
      )}

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
            style={styles.actionButtonFull}
          />
        </View>
      )}

      {onManagePeople && (
        <View style={styles.peopleContainer}>
          <PRGButton
            title="People & invites"
            onPress={onManagePeople}
            variant="secondary"
            style={styles.actionButtonFull}
            accessibilityLabel="Manage people and invites"
          />
          {property.my_role && property.my_role !== 'owner' ? (
            <Text style={[styles.roleHint, { color: colors.textSecondary }]}>
              Your access: {property.my_role === 'edit' ? 'Edit' : 'View only'}
            </Text>
          ) : null}
        </View>
      )}

      {onDelete && (
        <View style={styles.deleteContainer}>
          <PRGButton
            title="Delete Property"
            onPress={() => {
              if (deleting) return;

              if (Platform.OS === 'web') {
                const confirmed = window.confirm(
                  `Are you sure you want to delete "${property.nickname || property.address_free_text}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`
                );
                if (confirmed) onDelete();
              } else {
                Alert.alert(
                  'Delete Property',
                  `Are you sure you want to delete "${property.nickname || property.address_free_text}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete },
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
  helper: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
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
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    minWidth: 80,
  },
  actionContainer: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  actionButtonFull: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  statusOption: {
    marginBottom: spacing.sm,
  },
  inactiveNotice: {
    marginTop: spacing.md,
  },
  peopleContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  roleHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  deleteContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  deleteButton: {
    width: '100%',
  },
});
