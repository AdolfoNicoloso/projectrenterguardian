import React from 'react';
import { View, Text } from 'react-native';
import { PRGButton } from '../../components';
import { getInspectionTypeCopy } from '../../constants/inspectionTypes';
import { useTheme } from '../../theme/useTheme';
import type { Inspection } from '../../types';
import { styles } from './wizardStyles';

export function CompleteStep({
  inspection,
  onComplete,
  saving,
}: {
  inspection: Inspection;
  onComplete: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const copy = getInspectionTypeCopy(inspection.inspection_type);
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{copy.completeTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{copy.completeBody}</Text>
      <PRGButton
        title="View Report"
        onPress={onComplete}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}
