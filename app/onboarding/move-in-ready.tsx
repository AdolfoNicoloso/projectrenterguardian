import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { inspectionsService } from '../../src/services/inspectionsService';
import { propertiesService } from '../../src/services/propertiesService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

type MoveInStep = 'top' | 'new_subchoice';

/**
 * After converting Touring → Active: choose move-in baseline.
 */
export default function MoveInReadyScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [step, setStep] = useState<MoveInStep>('top');
  const [busy, setBusy] = useState(false);

  const goHome = async () => {
    try {
      await appProfileService.updateAppProfile({ onboarding_completed: true });
    } catch {
      // ignore
    }
    router.replace('/(tabs)/rents');
  };

  const goCheckInOptIn = () => {
    if (!propertyId) {
      void goHome();
      return;
    }
    router.replace(
      `/onboarding/check-in-ready?propertyId=${encodeURIComponent(propertyId)}`
    );
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

  const useTourAsMoveIn = async () => {
    if (!propertyId || busy) return;
    setBusy(true);
    try {
      const completed = await inspectionsService.getMyInspections({
        status: 'completed',
      });
      const tour = completed
        .filter(
          (i) =>
            i.property_id === propertyId && i.inspection_type === 'tour'
        )
        .sort((a, b) => {
          const aTime = Date.parse(a.completed_at || a.date_updated || '') || 0;
          const bTime = Date.parse(b.completed_at || b.date_updated || '') || 0;
          return bTime - aTime;
        })[0];

      if (tour) {
        await propertiesService.updateProperty(propertyId, {
          move_in_baseline_inspection_id: tour.id,
        });
        showToast('Tour saved as your move-in baseline', 'success');
        goCheckInOptIn();
        return;
      }

      // No completed tour — start move-in using existing spaces as the baseline.
      showToast('Starting move-in with your tour spaces', 'success');
      startMoveIn('existing');
    } catch (err) {
      console.error('Error using tour as move-in:', err);
      showToast('Could not use tour as move-in. Try a new inspection.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = useMemo(() => {
    if (step === 'new_subchoice') return 'How should we start?';
    return 'Start your move-in baseline?';
  }, [step]);

  const body = useMemo(() => {
    if (step === 'new_subchoice') {
      return 'Reuse rooms from your tour, or pick spaces from scratch for a fresh walkthrough.';
    }
    return 'Landlords often dispute deposits without a dated move-in record. Choose how to establish yours.';
  }, [step]);

  return (
    <ScrollableScreenContainer
      includeBottomSafeArea
      horizontalPadding={spacing.lg}
      topPadding={spacing.xl}
      bottomPadding={spacing.xl}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>

        {step === 'top' ? (
          <>
            <PRGButton
              title={busy ? 'Working…' : 'Use my tour as move-in'}
              onPress={() => {
                void useTourAsMoveIn();
              }}
              disabled={busy}
              style={styles.button}
              accessibilityLabel="Use tour documentation as move-in baseline"
            />
            <PRGButton
              title="Do a new move-in inspection"
              onPress={() => setStep('new_subchoice')}
              variant="secondary"
              style={styles.button}
              disabled={busy}
            />
            <PRGButton
              title="Not right now"
              onPress={goHome}
              variant="ghost"
              style={styles.button}
              disabled={busy}
            />
          </>
        ) : (
          <>
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
            <PRGButton
              title="Back"
              onPress={() => setStep('top')}
              variant="ghost"
              style={styles.button}
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
