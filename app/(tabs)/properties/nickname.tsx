import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  PRGButton,
  PRGInput,
  PRGHeader,
  PRGConfirmDialog,
  ScrollableScreenContainer,
  useToast,
} from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { useDiscardableForm } from '../../../src/hooks/useDiscardableForm';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { Routes } from '../../../src/navigation/routes';

/**
 * Final create step: nickname then create property (touring or active).
 */
export default function NicknameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    listing_url?: string;
    status?: string;
    tour_scheduled_at?: string;
  }>();
  const isTouring = params.status === 'touring';
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDirty = useMemo(
    () => Boolean(nickname.trim() || params.street),
    [nickname, params.street]
  );

  const discard = useDiscardableForm(isDirty, {
    title: 'Discard property?',
    message:
      'You are about to create this property. Discarding will not save it or create any rooms.',
    keepEditingLabel: 'Keep editing',
    discardLabel: 'Discard',
  });

  const leaveWithoutCreating = () => {
    router.replace(Routes.PROPERTIES.LIST);
  };

  const handleCancel = () => {
    discard.requestLeave(leaveWithoutCreating);
  };

  const handleCreate = async () => {
    if (!params.street || !params.city || !params.state || !params.zip) {
      setError('Missing property information');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const addressParts = [
        params.street,
        params.unit ? `Unit ${params.unit}` : null,
        `${params.city}, ${params.state} ${params.zip}`,
      ].filter(Boolean);
      const addressFreeText = addressParts.join(', ');

      const listingUrl =
        typeof params.listing_url === 'string' ? params.listing_url.trim() : '';
      const tourScheduledAt =
        typeof params.tour_scheduled_at === 'string' && params.tour_scheduled_at.trim()
          ? params.tour_scheduled_at.trim()
          : undefined;
      const property = await propertiesService.createProperty({
        address_free_text: addressFreeText,
        nickname: nickname || undefined,
        state_code: params.state || undefined,
        street: params.street,
        unit: params.unit || undefined,
        city: params.city,
        zip: parseInt(params.zip, 10),
        listing_url: listingUrl || undefined,
        status: isTouring ? 'touring' : 'active',
        ...(isTouring && tourScheduledAt
          ? { tour_scheduled_at: tourScheduledAt }
          : {}),
      });

      showToast(isTouring ? 'Touring property added' : 'Property created', 'success');
      router.replace(Routes.PROPERTIES.LIST);
      router.push(Routes.PROPERTIES.DETAIL(property.id));
    } catch (err: any) {
      setError(err.message || 'Failed to create property');
      showToast('Failed to create property', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="Nickname"
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
              Name this place
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Optional. Cancel exits without creating a property.
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
              label="Nickname"
              value={nickname}
              onChangeText={setNickname}
              placeholder={
                isTouring
                  ? 'e.g., Oak St walkup (optional)'
                  : 'e.g., Downtown Apartment (optional)'
              }
              style={styles.input}
            />

            <PRGButton
              title={isTouring ? 'Add touring property' : 'Create Property'}
              onPress={handleCreate}
              loading={loading}
              style={styles.button}
              accessibilityLabel="Create property"
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
  input: { marginBottom: 2 },
  button: { marginTop: spacing.md },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
