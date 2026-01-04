import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PRGHeader, ScrollableScreenContainer } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function GuidedInspectionPlaceholderScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Guided Inspection" showBack />
      <ScrollableScreenContainer
        includeBottomSafeArea={true}
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            HERE LIES THE GUIDED INSPECTION TOOL.
          </Text>
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
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});


