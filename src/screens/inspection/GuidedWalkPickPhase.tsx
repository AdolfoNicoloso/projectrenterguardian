import React from 'react';
import { View, Text } from 'react-native';
import { PRGButton, PRGInput } from '../../components';
import { SPACE_TYPES } from '../../constants/spaceTypes';
import { useTheme } from '../../theme/useTheme';
import type { Property, Space } from '../../types';
import { styles } from './guidedWalkStyles';

export function GuidedWalkPickPhase({
  pickTitle,
  pickBody,
  remainingExisting,
  showAddForm,
  allSpacesCount,
  completedCount,
  property,
  formError,
  displayName,
  spaceType,
  customTypeName,
  creating,
  saving,
  onBeginSpace,
  onShowAddForm,
  onChangeDisplayName,
  onChangeSpaceType,
  onChangeCustomTypeName,
  onResetForm,
  onCreateSpace,
  onFinishWalk,
}: {
  pickTitle: string;
  pickBody: string;
  remainingExisting: Space[];
  showAddForm: boolean;
  allSpacesCount: number;
  completedCount: number;
  property: Property | null;
  formError: string;
  displayName: string;
  spaceType: Space['space_type'];
  customTypeName: string;
  creating: boolean;
  saving: boolean;
  onBeginSpace: (space: Space) => void;
  onShowAddForm: () => void;
  onChangeDisplayName: (value: string) => void;
  onChangeSpaceType: (value: Space['space_type']) => void;
  onChangeCustomTypeName: (value: string) => void;
  onResetForm: () => void;
  onCreateSpace: () => void;
  onFinishWalk: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{pickTitle}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{pickBody}</Text>

      {remainingExisting.length > 0 && !showAddForm ? (
        <View style={styles.listBlock}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Existing spaces
          </Text>
          {remainingExisting.map((space) => (
            <PRGButton
              key={space.id}
              title={space.display_name}
              onPress={() => onBeginSpace(space)}
              variant="secondary"
              style={styles.spaceButton}
              accessibilityLabel={`Document ${space.display_name}`}
            />
          ))}
        </View>
      ) : null}

      {property?.id ? (
        <View
          style={[
            styles.addSpaceCard,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {!showAddForm ? (
            <PRGButton
              title={
                allSpacesCount === 0 || remainingExisting.length === 0
                  ? completedCount === 0
                    ? 'Add the first space'
                    : 'Add a space'
                  : 'Add a new space'
              }
              onPress={onShowAddForm}
              variant="primary"
              style={styles.spaceButton}
            />
          ) : (
            <View>
              <Text style={[styles.addSpaceTitle, { color: colors.text }]}>New space</Text>
              {formError ? (
                <Text style={[styles.inlineError, { color: colors.error }]}>{formError}</Text>
              ) : null}
              <PRGInput
                label="Display name *"
                value={displayName}
                onChangeText={onChangeDisplayName}
                placeholder="e.g., Bedroom 2, Patio"
                autoCapitalize="words"
              />
              <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
                Space type *
              </Text>
              <View style={styles.spaceTypeOptions}>
                {SPACE_TYPES.map((type) => (
                  <PRGButton
                    key={type.value}
                    title={type.label}
                    onPress={() => {
                      onChangeSpaceType(type.value);
                      if (type.value !== 'custom_space_type') onChangeCustomTypeName('');
                    }}
                    variant={spaceType === type.value ? 'primary' : 'secondary'}
                    style={styles.spaceTypeChip}
                  />
                ))}
              </View>
              {spaceType === 'custom_space_type' ? (
                <PRGInput
                  label="Custom type name *"
                  value={customTypeName}
                  onChangeText={onChangeCustomTypeName}
                  placeholder="e.g., Attic"
                  autoCapitalize="words"
                  maxLength={255}
                />
              ) : null}
              <View style={styles.addSpaceActions}>
                <PRGButton
                  title="Cancel"
                  onPress={onResetForm}
                  variant="ghost"
                  disabled={creating}
                  style={styles.addSpaceActionButton}
                />
                <PRGButton
                  title="Save & document"
                  onPress={onCreateSpace}
                  loading={creating}
                  disabled={
                    creating ||
                    !displayName.trim() ||
                    (spaceType === 'custom_space_type' && !customTypeName.trim())
                  }
                  style={styles.addSpaceActionButton}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {completedCount > 0 ? (
        <PRGButton
          title="No more spaces — continue"
          onPress={onFinishWalk}
          loading={saving}
          variant="secondary"
          style={styles.continueButton}
        />
      ) : null}
    </View>
  );
}
