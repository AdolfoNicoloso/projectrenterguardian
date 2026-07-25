import React from 'react';
import { View, Text } from 'react-native';
import { PRGButton } from '../../components';
import {
  getInspectionTypeCopy,
  getInspectionTypeLabel,
} from '../../constants/inspectionTypes';
import { useTheme } from '../../theme/useTheme';
import type { Inspection } from '../../types';
import { styles } from './wizardStyles';

export function IntroStep({
  inspection,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  onContinue: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{copy.introTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{copy.introBody}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Type: {getInspectionTypeLabel(inspection.inspection_type)}
      </Text>
      <PRGButton
        title="Get Started"
        onPress={onContinue}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}
