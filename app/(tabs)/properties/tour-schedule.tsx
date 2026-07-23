import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PRGConfirmDialog,
  ScrollableScreenContainer,
  DateField,
} from '../../../src/components';
import { useDiscardableForm } from '../../../src/hooks/useDiscardableForm';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { Routes } from '../../../src/navigation/routes';

/**
 * Touring create step: personal tour date/time (not a landlord booking).
 * Skippable — continues to nickname with or without a scheduled time.
 */
export default function TourScheduleScreen() {
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

  const isDirty = useMemo(
    () => Boolean(tourScheduledAt || params.street),
    [tourScheduledAt, params.street]
  );

  const discard = useDiscardableForm(isDirty, {
    title: 'Discard property?',
    message:
      'You have started creating a property. Discarding will not save anything.',
    keepEditingLabel: 'Keep editing',
    discardLabel: 'Discard',
  });

  const leaveWithoutCreating = () => {
    router.replace(Routes.PROPERTIES.LIST);
  };

  const handleCancel = () => {
    discard.requestLeave(leaveWithoutCreating);
  };

  const goToNickname = (scheduledAt: string | null) => {
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
        listing_url: params.listing_url || '',
        status: 'touring',
        tour_scheduled_at: scheduledAt || '',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="Tour time"
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
              When is your tour?
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              This is your personal tracker and reminder only — it does not schedule
              anything with the landlord or management agency. You can add or edit
              the tour date and time on the property anytime.
            </Text>

            {error ? (
              <Text
                style={[styles.errorText, { color: colors.error }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
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
              accessibilityLabel="Continue with tour date and time"
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
  button: { marginTop: spacing.md },
  skipButton: { marginTop: spacing.sm },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
