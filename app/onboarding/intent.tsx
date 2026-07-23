import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollableScreenContainer } from '../../src/components';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export type OnboardingIntent = 'touring' | 'renting';

/**
 * Onboarding entry: Touring vs Already renting. One tap advances to address.
 */
export default function OnboardingIntentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<OnboardingIntent | null>(null);

  const options: Array<{ value: OnboardingIntent; title: string; body: string }> = [
    {
      value: 'touring',
      title: 'Touring places',
      body: 'I’m looking at rentals and want to document walkthroughs.',
    },
    {
      value: 'renting',
      title: 'Already renting',
      body: 'I have a place (or keys) and want to document move-in condition.',
    },
  ];

  const choose = (intent: OnboardingIntent) => {
    if (selected) return;
    setSelected(intent);
    setTimeout(() => {
      router.push({
        pathname: '/onboarding/property-info',
        params: { intent },
      });
    }, 160);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollableScreenContainer
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            What brings you here?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We’ll tailor setup. You can always add more properties later.
          </Text>

          {options.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => choose(opt.value)}
                disabled={!!selected}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor:
                      isSelected || pressed ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? colors.primary + '18'
                      : pressed
                        ? colors.primary + '10'
                        : colors.card,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={opt.title}
              >
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  {opt.title}
                </Text>
                <Text style={[styles.optionBody, { color: colors.textSecondary }]}>
                  {opt.body}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollableScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { maxWidth: 400, width: '100%', alignSelf: 'center' },
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
  option: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  optionBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
});
