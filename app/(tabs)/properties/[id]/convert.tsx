import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  ScrollableScreenContainer,
  DateField,
  NumberPicker,
  useToast,
} from '../../../../src/components';
import { propertiesService } from '../../../../src/services/propertiesService';
import { usePropertiesStore } from '../../../../src/state/propertiesStore';
import {
  isToursHubPropertyStatus,
  propertyDisplayName,
} from '../../../../src/constants/propertyStatuses';
import { spacing, typography } from '../../../../src/theme';
import { useTheme } from '../../../../src/theme/useTheme';
import { isRequired } from '../../../../src/utils/validation';
import { leaseEndFromStartAndTerm } from '../../../../src/utils/dateTime';
import type { Property } from '../../../../src/types';

/**
 * Convert a Touring property to Active: set lease, optionally archive other tours.
 */
export default function ConvertPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const fetchList = usePropertiesStore((s) => s.fetchList);

  const [property, setProperty] = useState<Property | null>(null);
  const [otherTouring, setOtherTouring] = useState<Property[]>([]);
  const [leaseStartISO, setLeaseStartISO] = useState<string | null>(null);
  const [leaseEndISO, setLeaseEndISO] = useState<string | null>(null);
  const [leaseTerm, setLeaseTerm] = useState<number | null>(null);
  const [archiveOthers, setArchiveOthers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const [prop, list] = await Promise.all([
          propertiesService.getProperty(id),
          fetchList({ force: true }),
        ]);
        if (cancelled) return;
        setProperty(prop);
        if (prop.lease_start_date) setLeaseStartISO(prop.lease_start_date);
        if (prop.lease_end_date) setLeaseEndISO(prop.lease_end_date);
        if (prop.lease_term != null) setLeaseTerm(prop.lease_term);
        setOtherTouring(
          list.filter((p) => p.id !== id && isToursHubPropertyStatus(p.status))
        );
      } catch (err) {
        console.error(err);
        showToast('Failed to load property', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchList, showToast]);

  const title = useMemo(
    () => (property ? propertyDisplayName(property) : 'Convert'),
    [property]
  );

  const handleConvert = async () => {
    if (!id || !property) return;
    if (!isRequired(leaseStartISO)) {
      setError('Lease start date is required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updateProperty(id, {
        status: 'active',
        lease_start_date: leaseStartISO,
        lease_end_date: leaseEndISO,
        lease_term: leaseTerm,
      } as Partial<Property> & { lease_term?: number | null });

      if (archiveOthers && otherTouring.length > 0) {
        await Promise.all(
          otherTouring.map((p) => updateProperty(p.id, { status: 'archived' }))
        );
      }

      showToast('This is now your rental', 'success');
      router.replace(`/onboarding/move-in-ready?propertyId=${encodeURIComponent(id)}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to convert property');
      showToast('Failed to convert property', 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Choose this place" showBack />
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!property || !isToursHubPropertyStatus(property.status)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Choose this place" showBack />
        <View style={styles.centered}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Only Touring or Applied properties can be converted here.
          </Text>
          <PRGButton
            title="Go back"
            onPress={() => router.back()}
            style={styles.button}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Choose this place" showBack />
      <ScrollableScreenContainer
        includeTopSafeArea={false}
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.lg}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.prompt, { color: colors.text }]}>
          Make {title} your rental
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Add lease details to mark this place Active. Tour spaces and photos stay with the
          property.
        </Text>

        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : null}

        <View style={styles.field}>
          <DateField
            label="Lease start date *"
            valueISO={leaseStartISO}
            onChangeISO={(iso) => {
              setLeaseStartISO(iso);
              const derived = leaseEndFromStartAndTerm(iso, leaseTerm);
              if (derived) setLeaseEndISO(derived);
            }}
            dateOnly
            placeholder="Select lease start date"
          />
        </View>

        <View style={styles.field}>
          <NumberPicker
            label="Lease term (months)"
            value={leaseTerm}
            onChange={(term) => {
              setLeaseTerm(term);
              const derived = leaseEndFromStartAndTerm(leaseStartISO, term);
              if (derived) setLeaseEndISO(derived);
            }}
            min={1}
            max={36}
            placeholder="Optional"
          />
        </View>

        <View style={styles.field}>
          <DateField
            label="Lease end date"
            valueISO={leaseEndISO}
            onChangeISO={setLeaseEndISO}
            dateOnly
            minimumISO={leaseStartISO || undefined}
            placeholder="Auto from start + term (editable)"
          />
        </View>

        {otherTouring.length > 0 ? (
          <Pressable
            style={[styles.archiveRow, { borderColor: colors.border }]}
            onPress={() => setArchiveOthers((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: archiveOthers }}
          >
            <View style={styles.archiveText}>
              <Text style={[styles.archiveTitle, { color: colors.text }]}>
                Archive other touring places
              </Text>
              <Text style={[styles.archiveBody, { color: colors.textSecondary }]}>
                {otherTouring.length} other tour
                {otherTouring.length === 1 ? '' : 's'} will be archived (you can reopen later).
              </Text>
            </View>
            <Switch value={archiveOthers} onValueChange={setArchiveOthers} />
          </Pressable>
        ) : null}

        <PRGButton
          title="Confirm — this is my place"
          onPress={handleConvert}
          loading={saving}
          style={styles.button}
        />
      </ScrollableScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    alignItems: 'center',
  },
  scrollContent: { flexGrow: 1, maxWidth: 480, width: '100%', alignSelf: 'center' },
  prompt: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  archiveText: { flex: 1 },
  archiveTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  archiveBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  button: { marginTop: spacing.md },
  errorText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
