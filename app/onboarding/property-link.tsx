import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isValidOptionalHttpUrl } from '../../src/utils/validation';

/**
 * Optional listing URL step for onboarding create.
 * After address; before tour-schedule (touring) or nickname (renting).
 */
export default function OnboardingPropertyLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    status?: string;
  }>();
  const isTouring = params.status === 'touring';
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [listingUrl, setListingUrl] = useState('');
  const [error, setError] = useState('');
  const [skipping, setSkipping] = useState(false);

  const handleContinue = () => {
    if (!params.street || !params.city || !params.state || !params.zip) {
      setError('Missing property information');
      return;
    }

    if (!isValidOptionalHttpUrl(listingUrl)) {
      setError('Property link must be a valid http:// or https:// URL');
      return;
    }

    setError('');

    const nextParams = {
      street: params.street,
      unit: params.unit || '',
      city: params.city,
      state: params.state,
      zip: params.zip,
      listing_url: listingUrl.trim() || '',
      status: params.status || (isTouring ? 'touring' : 'active'),
    };

    if (isTouring) {
      router.push({
        pathname: '/onboarding/tour-schedule',
        params: nextParams,
      });
      return;
    }

    router.push({
      pathname: '/onboarding/nickname',
      params: nextParams,
    });
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await appProfileService.updateAppProfile({ onboarding_completed: true });
      router.replace('/(tabs)/rents');
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
            Property link
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Optional. Paste the listing or listing page URL if you have one.
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Property Link"
            value={listingUrl}
            onChangeText={setListingUrl}
            placeholder="https://… (optional)"
            autoCapitalize="none"
            keyboardType="url"
            style={styles.input}
          />

          <PRGButton
            title="Continue"
            onPress={handleContinue}
            disabled={skipping}
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
