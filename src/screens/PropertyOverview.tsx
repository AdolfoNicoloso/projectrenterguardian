import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PRGCard, PRGEditableTextRow, PRGButton, DateField, NumberPicker } from '../components';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { formatDisplayDate, leaseEndFromStartAndTerm } from '../utils/cmsDateTime';
import { isValidOptionalHttpUrl } from '../utils/validation';
import { Routes } from '../navigation/routes';
import { PROPERTY_STATUSES, getPropertyStatusLabel, isActivePropertyStatus, isToursHubPropertyStatus, formatPropertyAddress, propertyDisplayName } from '../constants/propertyStatuses';
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
  onUpdateLeaseEnd?: (leaseEnd: string | null) => void;
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
  onUpdateLeaseEnd,
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
  const [editingLeaseEnd, setEditingLeaseEnd] = useState(false);
  const [editingLeaseTerm, setEditingLeaseTerm] = useState(false);
  const [editingTour, setEditingTour] = useState(
    () => initialEditingTour && isToursHubPropertyStatus(property.status)
  );
  const [editingStatus, setEditingStatus] = useState(false);
  const [editLeaseStart, setEditLeaseStart] = useState<string | null>(
    property.lease_start_date || null
  );
  const [editLeaseEnd, setEditLeaseEnd] = useState<string | null>(
    property.lease_end_date || null
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
    setEditLeaseEnd(property.lease_end_date || null);
    setEditLeaseTerm(property.lease_term ?? null);
  }, [property.lease_start_date, property.lease_end_date, property.lease_term]);

  useEffect(() => {
    setEditTourAt(property.tour_scheduled_at || null);
  }, [property.tour_scheduled_at]);

  const loadIncompleteTour = useCallback(async () => {
    if (!isToursHubPropertyStatus(property.status)) {
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
  const inToursPipeline = isToursHubPropertyStatus(property.status);
  const canStartInspection =
    isActivePropertyStatus(property.status) || inToursPipeline;

  const saveLeaseStart = () => {
    if (onUpdateLeaseStart && editLeaseStart) {
      onUpdateLeaseStart(editLeaseStart);
      const derived = leaseEndFromStartAndTerm(
        editLeaseStart,
        editLeaseTerm ?? property.lease_term
      );
      if (derived && onUpdateLeaseEnd) {
        onUpdateLeaseEnd(derived);
        setEditLeaseEnd(derived);
      }
    }
    setEditingLeaseStart(false);
  };

  const cancelLeaseStart = () => {
    setEditLeaseStart(property.lease_start_date || null);
    setEditLeaseEnd(property.lease_end_date || null);
    setEditingLeaseStart(false);
  };

  const saveLeaseEnd = () => {
    if (onUpdateLeaseEnd) {
      onUpdateLeaseEnd(editLeaseEnd);
    }
    setEditingLeaseEnd(false);
  };

  const cancelLeaseEnd = () => {
    setEditLeaseEnd(property.lease_end_date || null);
    setEditingLeaseEnd(false);
  };

  const saveLeaseTerm = () => {
    if (onUpdateLeaseTerm !== undefined) {
      onUpdateLeaseTerm(editLeaseTerm);
      const derived = leaseEndFromStartAndTerm(
        editLeaseStart || property.lease_start_date,
        editLeaseTerm
      );
      if (derived && onUpdateLeaseEnd) {
        onUpdateLeaseEnd(derived);
        setEditLeaseEnd(derived);
      }
    }
    setEditingLeaseTerm(false);
  };

  const cancelLeaseTerm = () => {
    setEditLeaseTerm(property.lease_term ?? null);
    setEditLeaseEnd(property.lease_end_date || null);
    setEditingLeaseTerm(false);
  };

  const closeOtherEditors = () => {
    setEditingLeaseStart(false);
    setEditingLeaseEnd(false);
    setEditingLeaseTerm(false);
    setEditingTour(false);
    setEditingStatus(false);
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
          displayValue={propertyDisplayName(property)}
          onSave={(value) => {
            const next = value.trim();
            const address = formatPropertyAddress(property);
            // Empty or equal to the address → no custom nickname (address is the name).
            onUpdateNickname?.(
              !next || (address && next === address) ? '' : next
            );
          }}
          placeholder="Optional short name (defaults to full address)"
          editable={!!onUpdateNickname}
          allowEmpty
          numberOfLines={3}
        />
      </PRGCard>

      <PRGCard onPress={() => router.push(Routes.PROPERTIES.ADDRESS.EDIT(property.id))}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
            {formatPropertyAddress(property) || property.address_free_text}
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

      {inToursPipeline ? (
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
                      closeOtherEditors();
                      setEditingTour(true);
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
                        closeOtherEditors();
                        setEditingLeaseStart(true);
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
                  onChangeISO={(iso) => {
                    setEditLeaseStart(iso);
                    const derived = leaseEndFromStartAndTerm(
                      iso,
                      editLeaseTerm ?? property.lease_term
                    );
                    if (derived) setEditLeaseEnd(derived);
                  }}
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
                        closeOtherEditors();
                        setEditingLeaseTerm(true);
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
                  onChange={(term) => {
                    setEditLeaseTerm(term);
                    const derived = leaseEndFromStartAndTerm(
                      editLeaseStart || property.lease_start_date,
                      term
                    );
                    if (derived) setEditLeaseEnd(derived);
                  }}
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

          <PRGCard>
            {!editingLeaseEnd ? (
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Lease End</Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.value, styles.valueFlex, { color: colors.text }]}>
                    {formatDisplayDate(property.lease_end_date) || 'N/A'}
                  </Text>
                  {onUpdateLeaseEnd ? (
                    <Text
                      style={[styles.editHint, { color: colors.primary }]}
                      onPress={() => {
                        setEditLeaseEnd(property.lease_end_date || null);
                        closeOtherEditors();
                        setEditingLeaseEnd(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit lease end date"
                    >
                      Tap to edit
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View>
                <DateField
                  label="Lease End Date"
                  valueISO={editLeaseEnd}
                  onChangeISO={setEditLeaseEnd}
                  dateOnly
                  minimumISO={
                    editLeaseStart || property.lease_start_date || undefined
                  }
                  placeholder="Auto from start + term (editable)"
                />
                <View style={styles.editActions}>
                  <PRGButton
                    title="Clear"
                    onPress={() => setEditLeaseEnd(null)}
                    variant="ghost"
                    style={styles.actionButton}
                  />
                  <PRGButton
                    title="Cancel"
                    onPress={cancelLeaseEnd}
                    variant="ghost"
                    style={styles.actionButton}
                  />
                  <PRGButton
                    title="Save"
                    onPress={saveLeaseEnd}
                    variant="primary"
                    style={styles.actionButton}
                  />
                </View>
              </View>
            )}
          </PRGCard>
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
                    closeOtherEditors();
                    setEditingStatus(true);
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
              Active can start any inspection. Touring and Applied can start a Tour.
              Mark Applied after you apply; convert to Active when you move in.
            </Text>
            {PROPERTY_STATUSES.map((status) => (
              <PRGButton
                key={status.value}
                title={status.label}
                onPress={() => {
                  // Touring / Applied → Active needs lease; use convert flow.
                  if (
                    inToursPipeline &&
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

      {!canStartInspection ? (
        <PRGCard style={styles.inactiveNotice}>
          <Text style={[styles.helper, { color: colors.textSecondary, marginBottom: 0 }]}>
            Set this property’s status to Active, Touring, or Applied to start an inspection.
          </Text>
        </PRGCard>
      ) : null}

      {canStartInspection || showDraftButton || showArchiveButton || onManagePeople ? (
        <View style={styles.actionsStack}>
          {canStartInspection ? (
            <PRGButton
              title={
                inToursPipeline
                  ? incompleteTourId
                    ? 'Continue tour'
                    : 'Start Tour'
                  : 'Start Inspection'
              }
              onPress={() => {
                if (inToursPipeline && incompleteTourId) {
                  router.push(`/(tabs)/inspections/${incompleteTourId}`);
                  return;
                }
                router.push(
                  inToursPipeline
                    ? `/(tabs)/inspections/new?propertyId=${property.id}&inspectionType=tour`
                    : `/(tabs)/inspections/new?propertyId=${property.id}`
                );
              }}
              variant="primary"
              style={styles.actionButtonFull}
            />
          ) : null}

          {showDraftButton || showArchiveButton ? (
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
          ) : null}

          {onManagePeople ? (
            <View>
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
          ) : null}
        </View>
      ) : null}

      {onDelete && (
        <View style={styles.deleteContainer}>
          <PRGButton
            title="Delete Property"
            onPress={() => {
              if (deleting) return;

              if (Platform.OS === 'web') {
                const confirmed = window.confirm(
                  `Are you sure you want to delete "${propertyDisplayName(property)}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`
                );
                if (confirmed) onDelete();
              } else {
                Alert.alert(
                  'Delete Property',
                  `Are you sure you want to delete "${propertyDisplayName(property)}"?\n\nAll information, including Reports, will be deleted as well.\n\nThis action cannot be undone.`,
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
  actionsStack: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButtonFull: {
    width: '100%',
  },
  statusOption: {
    marginBottom: spacing.sm,
  },
  inactiveNotice: {
    marginTop: spacing.md,
  },
  roleHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  deleteContainer: {
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  deleteButton: {
    width: '100%',
  },
});
