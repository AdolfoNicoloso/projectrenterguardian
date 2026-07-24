import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function TourReadyScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { colors } = useTheme();

  const startTour = () => {
    if (!propertyId) {
      router.replace('/(tabs)/tours');
      return;
    }
    router.replace(
      `/(tabs)/inspections/new?propertyId=${encodeURIComponent(propertyId)}&inspectionType=tour`
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
        <Text style={[styles.title, { color: colors.text }]}>Ready to tour?</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Walk room by room—add spaces as you go, capture photos and notes, and pause
          anytime. You can add more places from Home whenever you want.
        </Text>
        <PRGButton title="Start tour" onPress={startTour} style={styles.button} />
        <PRGButton
          title="Add another place"
          onPress={() =>
            router.replace({
              pathname: '/onboarding/property-info',
              params: { intent: 'touring' },
            })
          }
          variant="secondary"
          style={styles.button}
        />
        <PRGButton
          title="Go to Home"
          onPress={() => router.replace('/(tabs)/tours')}
          variant="ghost"
          style={styles.button}
        />
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
