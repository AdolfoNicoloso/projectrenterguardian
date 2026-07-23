import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGHeader, PRGButton, ScrollableScreenContainer } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

/**
 * Legacy route kept so deep links / old sessions do not dead-end.
 * Immediately forwards into the real inspection start flow.
 */
export default function GuidedInspectionPlaceholderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();

  useEffect(() => {
    const target = propertyId
      ? `/(tabs)/inspections/new?propertyId=${encodeURIComponent(propertyId)}&inspectionType=move_in`
      : '/(tabs)/inspections/new?inspectionType=move_in';
    router.replace(target);
  }, [propertyId, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Guided Inspection" showBack={false} />
      <ScrollableScreenContainer
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content} accessibilityLabel="Opening guided inspection">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Opening your guided inspection…
          </Text>
          <PRGButton
            title="Continue"
            onPress={() => {
              const target = propertyId
                ? `/(tabs)/inspections/new?propertyId=${encodeURIComponent(propertyId)}&inspectionType=move_in`
                : '/(tabs)/inspections/new?inspectionType=move_in';
              router.replace(target);
            }}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </ScrollableScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
