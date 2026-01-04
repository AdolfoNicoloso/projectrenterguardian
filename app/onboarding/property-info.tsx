import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';

export default function OnboardingPropertyInfoScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!isRequired(street) || !isRequired(city) || !isRequired(state) || !isRequired(zip)) {
      setError('Street, City, State, and ZIP are required');
      return;
    }

    // Validate ZIP is numeric
    if (isNaN(Number(zip)) || zip.length !== 5) {
      setError('ZIP must be a 5-digit number');
      return;
    }

    setError('');

    // Navigate to lease-info screen with property info as params
    router.push({
      pathname: '/onboarding/lease-info',
      params: {
        street,
        unit: unit || '',
        city,
        state,
        zip,
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
            Tell us about the rental property
          </Text>

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
            disabled={!street.trim() || !city.trim() || !state.trim() || !zip.trim()}
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
