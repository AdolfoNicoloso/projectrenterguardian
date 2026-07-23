import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  PRGButton,
  PRGInput,
  PRGHeader,
  PRGConfirmDialog,
  ScrollableScreenContainer,
} from '../../../src/components';
import { useDiscardableForm } from '../../../src/hooks/useDiscardableForm';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { isRequired } from '../../../src/utils/validation';
import { Routes } from '../../../src/navigation/routes';

/**
 * Address step for mid-app property create. Expects status from status-intent.
 */
export default function PropertyInfoScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const resolvedStatus =
    status === 'touring' || status === 'active' ? status : null;
  const { colors } = useTheme();
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  const isDirty = useMemo(
    () =>
      Boolean(
        street.trim() ||
          unit.trim() ||
          city.trim() ||
          state.trim() ||
          zip.trim()
      ),
    [street, unit, city, state, zip]
  );

  const discard = useDiscardableForm(isDirty, {
    title: 'Discard property?',
    message:
      'You have started entering property details. Discarding will not create a property or any rooms.',
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
    if (!resolvedStatus) {
      setError('Choose Touring or Already renting first');
      return;
    }
    if (!isRequired(street) || !isRequired(city) || !isRequired(state) || !isRequired(zip)) {
      setError('Street, City, State, and ZIP are required');
      return;
    }

    if (isNaN(Number(zip)) || zip.length !== 5) {
      setError('ZIP must be a 5-digit number');
      return;
    }

    setError('');

    router.push({
      pathname: '/(tabs)/properties/property-link',
      params: {
        street,
        unit: unit || '',
        city,
        state,
        zip,
        status: resolvedStatus,
      },
    });
  };

  if (!resolvedStatus) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="New property" showBack onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Choose Touring or Already renting first.
          </Text>
          <PRGButton
            title="Go back"
            onPress={() => router.replace('/(tabs)/properties/status-intent')}
            style={styles.button}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="New property"
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
            <Text style={[styles.prompt, { color: colors.text }]}>
              {resolvedStatus === 'touring'
                ? 'Where are you touring?'
                : 'Tell us about the rental property'}
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Required fields are marked with *. You can cancel anytime without creating a
              property.
            </Text>

            {error ? (
              <Text
                style={[styles.errorText, { color: colors.error }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <PRGInput
              label="Street *"
              value={street}
              onChangeText={setStreet}
              placeholder="123 Main St."
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="Unit"
              value={unit}
              onChangeText={setUnit}
              placeholder="Apartment unit, etc"
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="City *"
              value={city}
              onChangeText={setCity}
              placeholder="City"
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="State *"
              value={state}
              onChangeText={setState}
              placeholder="e.g., CA"
              autoCapitalize="characters"
              maxLength={2}
              style={styles.input}
            />

            <PRGInput
              label="ZIP *"
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP"
              keyboardType="numeric"
              maxLength={5}
              style={styles.input}
            />

            <PRGButton
              title="Continue"
              onPress={handleContinue}
              disabled={!street.trim() || !city.trim() || !state.trim() || !zip.trim()}
              style={styles.button}
              accessibilityLabel="Continue to property link"
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
  container: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    alignItems: 'center',
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
  input: { marginBottom: 2.5 },
  button: { marginTop: spacing.md },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
