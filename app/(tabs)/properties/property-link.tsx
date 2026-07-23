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
import { isValidOptionalHttpUrl } from '../../../src/utils/validation';
import { Routes } from '../../../src/navigation/routes';

/**
 * Optional listing URL step for mid-app create.
 * Placed after address, before tour-schedule (touring) or nickname (renting).
 */
export default function PropertyLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    status?: string;
  }>();
  const resolvedStatus =
    params.status === 'touring' || params.status === 'active' ? params.status : null;
  const { colors } = useTheme();
  const [listingUrl, setListingUrl] = useState('');
  const [error, setError] = useState('');

  const isDirty = useMemo(
    () => Boolean(listingUrl.trim() || params.street),
    [listingUrl, params.street]
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
      status: resolvedStatus,
    };

    if (resolvedStatus === 'touring') {
      router.push({
        pathname: '/(tabs)/properties/tour-schedule',
        params: nextParams,
      });
      return;
    }

    router.push({
      pathname: '/(tabs)/properties/nickname',
      params: nextParams,
    });
  };

  if (!resolvedStatus || !params.street) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="New property" showBack onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Enter the property address first.
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
              Property link
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Optional. Paste the listing or listing page URL if you have one.
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
              style={styles.button}
              accessibilityLabel="Continue"
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
