import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, ScrollableScreenContainer, DateField, NumberPicker } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';

export default function OnboardingLeaseInfoScreen() {
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
  const [leaseTerm, setLeaseTerm] = useState<number | null>(null);
  const [error, setError] = useState('');

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

    // Navigate to nickname screen with all property info as params
    router.push({
      pathname: '/onboarding/nickname',
      params: {
        street: params.street,
        unit: params.unit || '',
        city: params.city,
        state: params.state,
        zip: params.zip,
        leaseStartISO: leaseStartISO,
        leaseTerm: leaseTerm ? leaseTerm.toString() : '',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollableScreenContainer
        includeBottomSafeArea={true}
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            Lease Information
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <View style={styles.input}>
            <DateField
              label="Lease Start Date *"
              valueISO={leaseStartISO}
              onChangeISO={setLeaseStartISO}
              dateOnly={true}
              placeholder="Select lease start date"
            />
          </View>

          <View style={styles.input}>
            <NumberPicker
              label="Lease Term (months)"
              value={leaseTerm}
              onChange={setLeaseTerm}
              min={1}
              max={36}
              placeholder="Select number of months"
            />
          </View>

          <PRGButton
            title="Continue"
            onPress={handleContinue}
            disabled={!leaseStartISO}
            style={styles.button}
          />
        </View>
      </ScrollableScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
