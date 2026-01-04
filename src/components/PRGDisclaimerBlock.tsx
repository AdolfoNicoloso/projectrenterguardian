import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { DisclaimerBlock } from '../types';

interface PRGDisclaimerBlockProps {
  disclaimer: DisclaimerBlock;
}

export const PRGDisclaimerBlock: React.FC<PRGDisclaimerBlockProps> = ({ disclaimer }) => {
  const { colors } = useTheme();
  
  // Simple markdown rendering (for Phase 1)
  // In Phase 2, consider using a proper markdown renderer
  const renderContent = (content: string) => {
    // Basic markdown parsing
    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('#')) {
        return (
          <Text key={index} style={[styles.heading, { color: colors.text }]}>
            {line.replace(/^#+\s*/, '')}
          </Text>
        );
      }
      if (line.trim() === '') {
        return <View key={index} style={styles.spacer} />;
      }
      return (
        <Text key={index} style={[styles.paragraph, { color: colors.textSecondary }]}>
          {line}
        </Text>
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary, borderLeftColor: colors.primary }]}>
      <Text style={[styles.title, { color: colors.text }]}>{disclaimer.title}</Text>
      <ScrollView style={styles.content}>
        {renderContent(disclaimer.content)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.sm,
  },
  content: {
    maxHeight: 200,
  },
  heading: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: typography.lineHeight.relaxed * typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.xs,
  },
});


