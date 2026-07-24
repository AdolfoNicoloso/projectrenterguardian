import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

/**
 * After converting Touring → Active: choose Move-In reuse vs fresh.
 */
export default function MoveInReadyScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { colors } = useTheme();

  const goHome = async () => {
    try {
      await appProfileService.updateAppProfile({ onboarding_completed: true });
    } catch {
      // ignore
    }
    router.replace('/(tabs)/rents');
  };

  const startMoveIn = (spaceWalk: 'existing' | 'pick') => {
    if (!propertyId) {
      void goHome();
      return;
    }
    router.replace(
      `/(tabs)/inspections/new?propertyId=${encodeURIComponent(propertyId)}&inspectionType=move_in&spaceWalk=${spaceWalk}`
    );
  };

  return (
    <ScrollableScreenContainer
      includeBottomSafeArea
      horizontalPadding={spacing.lg}
      topPadding={spacing.xl}
      bottomPadding={spacing.xl}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Start your Move-In?
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You can reuse spaces from your tour as the foundation, or start a fresh
          walkthrough. Tour photos stay on the property either way.
        </Text>
        <PRGButton
          title="Reuse tour spaces"
          onPress={() => startMoveIn('existing')}
          style={styles.button}
          accessibilityLabel="Start move-in using existing spaces"
        />
        <PRGButton
          title="Start a fresh Move-In"
          onPress={() => startMoveIn('pick')}
          variant="secondary"
          style={styles.button}
        />
        <PRGButton title="Not right now" onPress={goHome} variant="ghost" style={styles.button} />
      </View>
    </ScrollableScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  button: { marginTop: spacing.sm },
});
