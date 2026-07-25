import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PRGConfirmDialog,
  ScrollableScreenContainer,
  DateField,
  NumberPicker,
} from '../../../src/components';
import { useDiscardableForm } from '../../../src/hooks/useDiscardableForm';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { isRequired } from '../../../src/utils/validation';
import { leaseEndFromStartAndTerm } from '../../../src/utils/dateTime';
import { Routes } from '../../../src/navigation/routes';

export default function LeaseInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>();
  const { colors } = useTheme();
  const [leaseStartISO, setLeaseStartISO] = useState<string | null>(null);
  const [leaseEndISO, setLeaseEndISO] = useState<string | null>(null);
  const [leaseTerm, setLeaseTerm] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Address already entered on previous step counts as dirty for cancel
  const isDirty = useMemo(
    () =>
      Boolean(
        leaseStartISO ||
          leaseEndISO ||
          leaseTerm != null ||
          params.street ||
          params.city ||
          params.state ||
          params.zip
      ),
    [
      leaseStartISO,
      leaseEndISO,
      leaseTerm,
      params.street,
      params.city,
      params.state,
      params.zip,
    ]
  );

  const discard = useDiscardableForm(isDirty, {
    title: 'Discard property?',
    message:
      'You have started creating a property. Discarding will not save anything or create rooms.',
    keepEditingLabel: 'Keep editing',
    discardLabel: 'Discard',
  });

  const leaveWithoutCreating = () => {
    router.replace(Routes.PROPERTIES.LIST);
  };

  const handleCancel = () => {
    discard.requestLeave(leaveWithoutCreating);
  };

  const handleContinue = () => {
    if (!isRequired(leaseStartISO)) {
      setError('Lease start date is required');
      return;
    }

    if (!params.street || !params.city || !params.state || !params.zip) {
      setError('Missing property information');
      return;
    }

    setError('');

    router.push({
      pathname: '/(tabs)/properties/nickname',
      params: {
        street: params.street,
        unit: params.unit || '',
        city: params.city,
        state: params.state,
        zip: params.zip,
        leaseStartISO: leaseStartISO,
        leaseEndISO: leaseEndISO || '',
        leaseTerm: leaseTerm ? leaseTerm.toString() : '',
        status: 'active',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="Lease details"
        showBack
        onBack={() => {
          if (router.canGoBack()) router.back();
          else handleCancel();
        }}
        rightAction={{
          label: 'Cancel',
          onPress: handleCancel,
        }}
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollableScreenContainer
          includeTopSafeArea={false}
          includeBottomSafeArea
          horizontalPadding={spacing.lg}
          topPadding={spacing.lg}
          bottomPadding={spacing.xl}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={Platform.OS === 'web'}
        >
          <View style={styles.content}>
            <Text style={[styles.prompt, { color: colors.text }]}>Lease information</Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Cancel exits without creating a property.
            </Text>

            {error ? (
              <Text
                style={[styles.errorText, { color: colors.error }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <View style={styles.input}>
              <DateField
                label="Lease Start Date *"
                valueISO={leaseStartISO}
                onChangeISO={(iso) => {
                  setLeaseStartISO(iso);
                  const derived = leaseEndFromStartAndTerm(iso, leaseTerm);
                  if (derived) setLeaseEndISO(derived);
                }}
                dateOnly={true}
                placeholder="Select lease start date"
              />
            </View>

            <View style={styles.input}>
              <NumberPicker
                label="Lease Term (months)"
                value={leaseTerm}
                onChange={(term) => {
                  setLeaseTerm(term);
                  const derived = leaseEndFromStartAndTerm(leaseStartISO, term);
                  if (derived) setLeaseEndISO(derived);
                }}
                min={1}
                max={36}
                placeholder="Select number of months"
              />
            </View>

            <View style={styles.input}>
              <DateField
                label="Lease End Date"
                valueISO={leaseEndISO}
                onChangeISO={setLeaseEndISO}
                dateOnly={true}
                minimumISO={leaseStartISO || undefined}
                placeholder="Auto from start + term (editable)"
              />
            </View>

            <PRGButton
              title="Continue"
              onPress={handleContinue}
              disabled={!leaseStartISO}
              style={styles.button}
              accessibilityLabel="Continue to nickname"
            />

            <PRGButton
              title="Cancel"
              onPress={handleCancel}
              variant="ghost"
              style={styles.button}
              accessibilityLabel="Cancel property creation"
            />
          </View>
        </ScrollableScreenContainer>
      </KeyboardAvoidingView>

      <PRGConfirmDialog
        visible={discard.confirmVisible}
        title={discard.confirmTitle}
        message={discard.confirmMessage}
        cancelLabel={discard.keepEditingLabel}
        confirmLabel={discard.discardLabel}
        destructive
        onCancel={discard.keepEditing}
        onConfirm={discard.confirmDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  prompt: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  helper: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: 2,
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
