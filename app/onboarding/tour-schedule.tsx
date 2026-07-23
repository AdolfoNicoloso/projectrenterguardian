import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  PRGButton,
  ScrollableScreenContainer,
  DateField,
} from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

/**
 * Onboarding touring step: personal tour date/time before nickname.
 */
export default function OnboardingTourScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    listing_url?: string;
    status?: string;
  }>();
  const { colors } = useTheme();
  const [tourScheduledAt, setTourScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  const goToNickname = (scheduledAt: string | null) => {
    if (!params.street || !params.city || !params.state || !params.zip) {
      setError('Missing property information');
      return;
    }
    setError('');
    router.push({
      pathname: '/onboarding/nickname',
      params: {
        street: params.street,
        unit: params.unit || '',
        city: params.city,
        state: params.state,
        zip: params.zip,
        listing_url: params.listing_url || '',
        status: 'touring',
        tour_scheduled_at: scheduledAt || '',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollableScreenContainer
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            When is your tour?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This is your personal tracker and reminder only — it does not schedule
            anything with the landlord or management agency. You can add or edit
            the tour date and time on the property anytime.
          </Text>

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <DateField
            label="Tour date & time"
            valueISO={tourScheduledAt}
            onChangeISO={setTourScheduledAt}
            dateOnly={false}
            placeholder="Select date and time"
          />

          <PRGButton
            title="Continue"
            onPress={() => goToNickname(tourScheduledAt)}
            disabled={!tourScheduledAt}
            style={styles.button}
          />
          <PRGButton
            title="I don't have a tour yet."
            onPress={() => goToNickname(null)}
            variant="ghost"
            style={styles.skipButton}
            accessibilityLabel="Skip tour scheduling"
          />
        </View>
      </ScrollableScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
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
  button: { marginTop: spacing.md },
  skipButton: { marginTop: spacing.sm },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
