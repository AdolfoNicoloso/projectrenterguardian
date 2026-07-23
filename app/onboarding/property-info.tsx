import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';

/**
 * Address step for onboarding create. Expects intent from intent screen.
 * Continues to property link (then tour-schedule for touring, or nickname).
 */
export default function OnboardingPropertyInfoScreen() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const isTouring = intent === 'touring';
  const status = isTouring ? 'touring' : 'active';
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');
  const [skipping, setSkipping] = useState(false);

  const handleContinue = () => {
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
      pathname: '/onboarding/property-link',
      params: {
        street,
        unit: unit || '',
        city,
        state,
        zip,
        status,
      },
    });
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await appProfileService.updateAppProfile({ onboarding_completed: true });
      router.replace('/(tabs)/properties');
    } catch (err: any) {
      showToast(err?.message || 'Failed to continue', 'error');
      setSkipping(false);
    }
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
            {isTouring ? 'Where are you touring?' : 'Tell us about the rental property'}
          </Text>
          {isTouring ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Next you can add an optional listing link, then a personal tour time.
              Lease details come later if you choose this place.
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You can add lease details later on the property overview.
            </Text>
          )}

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

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
            disabled={!street.trim() || !city.trim() || !state.trim() || !zip.trim() || skipping}
            style={styles.button}
          />

          <PRGButton
            title="Skip"
            onPress={handleSkip}
            variant="ghost"
            loading={skipping}
            disabled={skipping}
            style={styles.button}
            accessibilityLabel={
              isTouring ? 'Skip adding a touring property' : 'Skip adding a rental property'
            }
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: 2.5,
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
