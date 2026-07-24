import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRGHeader, ScreenContainer, useWebPageContentStyle } from '../../src/components';
import { getLegalDocument, APP_DISPLAY_NAME } from '../../src/constants/legal';
import { spacing, typography, layout } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { useDesktopLayout } from '../../src/hooks/useDesktopLayout';

export default function LegalDocumentScreen() {
  const params = useLocalSearchParams<{ doc: string | string[] }>();
  const docId = Array.isArray(params.doc) ? params.doc[0] : params.doc;
  const doc = getLegalDocument(docId || '');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktopLayout();
  const contentStyle = useWebPageContentStyle(styles.content, layout.formMaxWidth);

  if (!doc) {
    return (
      <ScreenContainer includeTopSafeArea={!isDesktop} includeBottomSafeArea={false}>
        <PRGHeader title="Legal" showBack />
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>
            This document could not be found.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      includeTopSafeArea={!isDesktop}
      includeBottomSafeArea={false}
      horizontalPadding={isDesktop ? 0 : undefined}
    >
      <PRGHeader title={doc.title} showBack />
      <ScrollView
        contentContainerStyle={[
          contentStyle,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
          {APP_DISPLAY_NAME}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{doc.title}</Text>

        {doc.sections.map((section, index) => (
          <View key={`${doc.id}-${index}`} style={styles.section}>
            {section.heading ? (
              <Text style={[styles.heading, { color: colors.text }]}>
                {section.heading}
              </Text>
            ) : null}
            {section.paragraphs.map((paragraph, pIndex) => (
              <Text
                key={`${doc.id}-${index}-${pIndex}`}
                style={[styles.paragraph, { color: colors.textSecondary }]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  missing: {
    padding: spacing.lg,
  },
  missingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
});
