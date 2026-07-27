import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer, useToast } from '../../src/components';
import { propertiesService } from '../../src/services/propertiesService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

const MONTH_OPTIONS = [
  { months: 3, label: 'Remind me in 3 months' },
  { months: 6, label: 'Remind me in 6 months' },
  { months: 12, label: 'Remind me in 12 months' },
] as const;

/**
 * Opt-in mid-tenancy check-in reminder after move-in baseline is set.
 */
export default function CheckInReadyScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = () => {
    router.replace('/(tabs)/rents');
  };

  const setReminder = async (months: number) => {
    if (!propertyId || busy) return;
    setBusy(true);
    try {
      const next = new Date();
      next.setMonth(next.getMonth() + months);
      await propertiesService.updateProperty(propertyId, {
        next_check_in_at: next.toISOString(),
        check_in_reminder_opt_in: true,
      });
      showToast(`Check-in reminder set for ${months} months`, 'success');
      finish();
    } catch (err) {
      console.error('Error setting check-in reminder:', err);
      showToast('Could not save reminder', 'error');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!propertyId) {
      finish();
      return;
    }
    setBusy(true);
    try {
      await propertiesService.updateProperty(propertyId, {
        check_in_reminder_opt_in: false,
        next_check_in_at: null,
      });
    } catch {
      // ignore
    } finally {
      setBusy(false);
      finish();
    }
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
          Want a check-in reminder?
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          People who keep a simple inspection trail often protect thousands in
          deposits. We can nudge you later to document how the place looks during
          your tenancy.
        </Text>

        {!choosing ? (
          <>
            <PRGButton
              title={busy ? 'Saving…' : 'Remind me in 6 months'}
              onPress={() => {
                void setReminder(6);
              }}
              disabled={busy}
              style={styles.button}
            />
            <PRGButton
              title="Choose a different time"
              onPress={() => setChoosing(true)}
              variant="secondary"
              style={styles.button}
              disabled={busy}
            />
            <PRGButton
              title="No thanks"
              onPress={() => {
                void decline();
              }}
              variant="ghost"
              style={styles.button}
              disabled={busy}
            />
          </>
        ) : (
          <>
            {MONTH_OPTIONS.map((opt) => (
              <PRGButton
                key={opt.months}
                title={opt.label}
                onPress={() => {
                  void setReminder(opt.months);
                }}
                variant={opt.months === 6 ? 'primary' : 'secondary'}
                style={styles.button}
                disabled={busy}
              />
            ))}
            <PRGButton
              title="Back"
              onPress={() => setChoosing(false)}
              variant="ghost"
              style={styles.button}
              disabled={busy}
            />
          </>
        )}
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
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: { marginBottom: spacing.sm },
});
