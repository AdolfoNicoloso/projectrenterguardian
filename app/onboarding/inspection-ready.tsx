import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function InspectionReadyGateScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const [loading, setLoading] = useState(false);
  const [showNotReadyMessage, setShowNotReadyMessage] = useState(false);

  const handleYes = async () => {
    setLoading(true);
    try {
      await appProfileService.updateAppProfile({ onboarding_completed: true });
      router.replace('/onboarding/guided-inspection-placeholder');
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
      await appProfileService.updateAppProfile({ onboarding_completed: true });
      router.replace('/(tabs)/properties');
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
          <Text style={[styles.message, { color: colors.text }]}>
            Okay! Come back whenever you are ready, or take the pictures yourself and we can pick it up from there.
          </Text>

          <PRGButton
            title="Okay!"
            onPress={handleOkay}
            loading={loading}
            style={styles.button}
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
          Are you ready for your first inspection?
        </Text>

        <Text style={[styles.body, { color: colors.textSecondary }]}>
          All you need to do is take pictures of every area and answer some questions, and we will then generate a report for your records!
        </Text>

        <PRGButton
          title="No, I am not ready yet."
          onPress={handleNo}
          disabled={loading}
          variant="secondary"
          style={styles.button}
        />

        <PRGButton
          title="Yes!"
          onPress={handleYes}
          loading={loading}
          style={styles.button}
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

