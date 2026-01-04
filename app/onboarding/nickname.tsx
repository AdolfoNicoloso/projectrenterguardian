import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { propertiesService } from '../../src/services/propertiesService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function OnboardingNicknameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    leaseStartISO?: string;
    leaseTerm?: string;
  }>();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!params.street || !params.city || !params.state || !params.zip || !params.leaseStartISO) {
      setError('Missing property information');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Construct address_free_text from components
      const addressParts = [
        params.street,
        params.unit ? `Unit ${params.unit}` : null,
        `${params.city}, ${params.state} ${params.zip}`,
      ].filter(Boolean);
      const addressFreeText = addressParts.join(', ');

      const property = await propertiesService.createProperty({
        address_free_text: addressFreeText,
        lease_start_date: params.leaseStartISO,
        lease_term: params.leaseTerm ? parseInt(params.leaseTerm, 10) : undefined,
        nickname: nickname || undefined,
        state_code: params.state || undefined,
        street: params.street,
        unit: params.unit || undefined,
        city: params.city,
        zip: parseInt(params.zip, 10),
      });

      showToast('Property created', 'success');
      // Navigate to inspection-ready screen for onboarding flow
      router.replace(`/onboarding/inspection-ready?propertyId=${property.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create property');
      showToast('Failed to create property', 'error');
    } finally {
      setLoading(false);
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
            Give your property a nickname
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g., Downtown Apartment (optional)"
            style={styles.input}
          />

          <PRGButton
            title="Create Property"
            onPress={handleCreate}
            loading={loading}
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

