import React from 'react';
import { View, Text } from 'react-native';
import { PRGButton } from '../../components';
import { propertyDisplayName } from '../../constants/propertyStatuses';
import { useTheme } from '../../theme/useTheme';
import type { Inspection, Property } from '../../types';
import { styles } from './wizardStyles';

export function ChoosePropertyStep({
  inspection,
  property,
  properties,
  payload,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  properties: Property[];
  payload: any;
  onContinue: (propertyId: string) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const selectedId = payload.selected_property_id || inspection.property_id;
  
  // If property is already set and matches, just show it
  if (property && selectedId === property.id) {
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Property Selected</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          {propertyDisplayName(property)}
        </Text>
        <PRGButton
          title="Continue"
          onPress={() => onContinue(property.id)}
          variant="primary"
          loading={saving}
          style={styles.continueButton}
        />
      </View>
    );
  }

  // If we have properties list, show selection
  if (properties.length > 0) {
    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Select Property</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Please select the property for this inspection.
        </Text>
        {properties.map((prop) => (
          <PRGButton
            key={prop.id}
            title={propertyDisplayName(prop)}
            onPress={() => onContinue(prop.id)}
            variant={selectedId === prop.id ? 'primary' : 'secondary'}
            style={styles.propertyButton}
          />
        ))}
      </View>
    );
  }

  // Fallback: use inspection property_id
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Property</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Using the property from this inspection.
      </Text>
      <PRGButton
        title="Continue"
        onPress={() => onContinue(inspection.property_id)}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}
