import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { styles } from './wizardStyles';

export function LegacySkipScopeStep({ onSkip }: { onSkip: () => void }) {
  const { colors } = useTheme();
  useEffect(() => {
    onSkip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Preparing your walkthrough…</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        You’ll document one space at a time—no need to select every room up front.
      </Text>
    </View>
  );
}
