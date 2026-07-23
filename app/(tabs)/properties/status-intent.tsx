import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PRGHeader,
  PRGConfirmDialog,
  ScrollableScreenContainer,
} from '../../../src/components';
import { useDiscardableForm } from '../../../src/hooks/useDiscardableForm';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { Routes } from '../../../src/navigation/routes';

type CreateStatus = 'touring' | 'active';

/**
 * First step of mid-app property create: Touring vs Already renting.
 * One tap advances to address.
 */
export default function PropertyStatusIntentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<CreateStatus | null>(null);

  const discard = useDiscardableForm(false, {
    title: 'Discard property?',
    message: 'Leave without creating a property.',
    keepEditingLabel: 'Stay',
    discardLabel: 'Leave',
  });

  const leave = () => router.replace(Routes.PROPERTIES.LIST);

  const handleCancel = () => {
    discard.requestLeave(leave);
  };

  const choose = (status: CreateStatus) => {
    if (selected) return;
    setSelected(status);
    // Brief highlight so the tap is visible before navigation.
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/properties/property-info',
        params: { status },
      });
    }, 160);
  };

  const options: Array<{ value: CreateStatus; title: string; body: string }> = [
    {
      value: 'touring',
      title: 'Touring',
      body: 'Document walkthroughs while comparing rentals.',
    },
    {
      value: 'active',
      title: 'Already renting',
      body: 'You have (or will have) a place to document.',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="New property"
        showBack
        onBack={handleCancel}
        rightAction={{ label: 'Cancel', onPress: handleCancel }}
      />
      <ScrollableScreenContainer
        includeTopSafeArea={false}
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            What kind of place?
          </Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Tap one to continue. You can change status later.
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

      <PRGConfirmDialog
        visible={discard.confirmVisible}
        title={discard.confirmTitle}
        message={discard.confirmMessage}
        cancelLabel={discard.keepEditingLabel}
        confirmLabel={discard.discardLabel}
        destructive
        onCancel={discard.keepEditing}
        onConfirm={discard.confirmDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
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
  helper: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
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
