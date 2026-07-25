import React from 'react';
import { View, Text } from 'react-native';
import { PRGButton } from '../../components';
import { useTheme } from '../../theme/useTheme';
import type { Space } from '../../types';
import { styles } from './guidedWalkStyles';

export function GuidedWalkAskNextPhase({
  completedCount,
  remainingExisting,
  saving,
  onContinueWith,
  onAddAnother,
  onChooseDifferent,
  onFinishWalk,
}: {
  completedCount: number;
  remainingExisting: Space[];
  saving: boolean;
  onContinueWith: (space: Space) => void;
  onAddAnother: () => void;
  onChooseDifferent: () => void;
  onFinishWalk: () => void;
}) {
  const { colors } = useTheme();
  const nextExisting = remainingExisting[0];

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>What’s next?</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {completedCount} space{completedCount === 1 ? '' : 's'} documented.
        {remainingExisting.length > 0
          ? ` ${remainingExisting.length} existing space${remainingExisting.length === 1 ? '' : 's'} still available.`
          : ''}
      </Text>

      {nextExisting ? (
        <PRGButton
          title={`Continue with ${nextExisting.display_name}`}
          onPress={() => onContinueWith(nextExisting)}
          variant="primary"
          style={styles.actionButton}
        />
      ) : null}

      <PRGButton
        title="Add another space"
        onPress={onAddAnother}
        variant="secondary"
        style={styles.actionButton}
      />

      {remainingExisting.length > 1 ? (
        <PRGButton
          title="Choose a different space"
          onPress={onChooseDifferent}
          variant="ghost"
          style={styles.actionButton}
        />
      ) : null}

      <PRGButton
        title="No more spaces — continue"
        onPress={onFinishWalk}
        loading={saving}
        disabled={completedCount === 0}
        variant={completedCount === 0 ? 'secondary' : 'primary'}
        style={styles.continueButton}
        accessibilityLabel="Finish documenting spaces"
      />
    </View>
  );
}
