import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { propertiesService } from '../../src/services/propertiesService';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

/**
 * Final onboarding create step: nickname then create (touring or active, no lease).
 */
export default function OnboardingNicknameScreen() {
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
        nickname: nickname.trim() || undefined,
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

      if (isTouring) {
        try {
          await appProfileService.updateAppProfile({ onboarding_completed: true });
        } catch {
          // Non-fatal; tour-ready / Home can still proceed
        }
        showToast('Touring property added', 'success');
      } else {
        showToast('Property created', 'success');
      }
      router.replace({
        pathname: '/onboarding/invite-collaborators',
        params: {
          propertyId: property.id,
          status: isTouring ? 'touring' : 'active',
        },
      });
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
            Name this place
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isTouring
              ? 'Leave blank to use the full address. A short nickname helps when you’re touring several rentals.'
              : 'Leave blank to use the full address. You can change it later.'}
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

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
