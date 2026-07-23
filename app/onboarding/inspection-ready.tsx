import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

/**
 * Gate after first property creation: start the real move-in inspection
 * or defer and land on the properties list.
 */
export default function InspectionReadyGateScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const [loading, setLoading] = useState(false);
  const [showNotReadyMessage, setShowNotReadyMessage] = useState(false);

  const completeOnboarding = async () => {
    await appProfileService.updateAppProfile({ onboarding_completed: true });
  };

  const handleYes = async () => {
    setLoading(true);
    try {
      await completeOnboarding();
      if (propertyId) {
        // Start the real guided inspection (move-in) for this property
        router.replace(
          `/(tabs)/inspections/new?propertyId=${encodeURIComponent(propertyId)}&inspectionType=move_in`
        );
      } else {
        router.replace('/(tabs)/inspections/new?inspectionType=move_in');
      }
    } catch (err: any) {
      showToast('Failed to update profile', 'error');
      setLoading(false);
    }
  };

  const handleNo = async () => {
    setShowNotReadyMessage(true);
  };

  const handleOkay = async () => {
    setLoading(true);
    try {
      await completeOnboarding();
      if (propertyId) {
        router.replace(`/(tabs)/properties/${propertyId}`);
      } else {
        router.replace('/(tabs)/properties');
      }
    } catch (err: any) {
      showToast('Failed to update profile', 'error');
      setLoading(false);
    }
  };

  if (showNotReadyMessage) {
    return (
      <ScrollableScreenContainer
        includeBottomSafeArea={true}
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>No rush</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Come back whenever you are ready. You can also add photos yourself from your property,
            then start a guided inspection when it suits you.
          </Text>

          <PRGButton
            title="Go to my property"
            onPress={handleOkay}
            loading={loading}
            style={styles.button}
            accessibilityLabel="Go to my property"
          />
        </View>
      </ScrollableScreenContainer>
    );
  }

  return (
    <ScrollableScreenContainer
      includeBottomSafeArea={true}
      horizontalPadding={spacing.lg}
      topPadding={spacing.xl}
      bottomPadding={spacing.xl}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={false}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Ready for your first Move-In inspection?
        </Text>

        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We will walk you room by room. Capture photos, add notes, and save a report you can keep
          for your records.
        </Text>

        <PRGButton
          title="Yes, start Move-In inspection"
          onPress={handleYes}
          loading={loading}
          style={styles.button}
          accessibilityLabel="Start guided Move-In inspection"
        />

        <PRGButton
          title="Not right now"
          onPress={handleNo}
          disabled={loading}
          variant="secondary"
          style={styles.button}
          accessibilityLabel="Skip inspection for now"
        />
      </View>
    </ScrollableScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  message: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  button: {
    marginTop: spacing.md,
  },
});
