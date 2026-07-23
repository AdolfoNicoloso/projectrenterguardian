import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton, PRGInput, PRGHeader, useToast } from '../../../../../src/components';
import { spacesService } from '../../../../../src/services/spacesService';
import { SPACE_TYPES } from '../../../../../src/constants/spaceTypes';
import { colors, spacing, typography } from '../../../../../src/theme';
import type { Space } from '../../../../../src/types';

export default function CreateSpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [spaceType, setSpaceType] = useState<Space['space_type']>('bedroom');
  const [customTypeName, setCustomTypeName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (spaceType === 'custom_space_type' && !customTypeName.trim()) {
      setError('Custom type name is required when "Custom" is selected');
      return;
    }

    if (!id) {
      setError('Property ID is missing');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const spaceData: {
        property: string;
        space_type: Space['space_type'];
        display_name: string;
        custom_space_type?: string;
      } = {
        property: id,
        space_type: spaceType,
        display_name: displayName.trim(),
      };

      // Include custom_space_type only if space_type is "custom_space_type"
      if (spaceType === 'custom_space_type' && customTypeName.trim()) {
        spaceData.custom_space_type = customTypeName.trim();
      }

      await spacesService.createSpace(spaceData);

      showToast('Space created', 'success');
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
      showToast('Failed to create space', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PRGHeader title="Add Space" showBack />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <PRGInput
              label="Display Name *"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g., Master Bedroom, Main Garage"
              autoCapitalize="words"
            />

            <View style={styles.spaceTypeContainer}>
              <Text style={styles.label}>Space Type *</Text>
              <View style={styles.spaceTypeOptions}>
                {SPACE_TYPES.map((type) => (
                  <PRGButton
                    key={type.value}
                    title={type.label}
                    onPress={() => {
                      setSpaceType(type.value);
                      if (type.value !== 'custom_space_type') {
                        setCustomTypeName('');
                      }
                    }}
                    variant={spaceType === type.value ? 'primary' : 'secondary'}
                    style={styles.spaceTypeButton}
                  />
                ))}
              </View>
              {spaceType === 'custom_space_type' && (
                <PRGInput
                  label="Custom Type Name *"
                  value={customTypeName}
                  onChangeText={setCustomTypeName}
                  placeholder="e.g., Garage, Attic, Basement"
                  autoCapitalize="words"
                  maxLength={255}
                  containerStyle={styles.customTypeInput}
                />
              )}
            </View>

            <PRGButton
              title="Create Space"
              onPress={handleCreate}
              loading={loading}
              disabled={!displayName.trim() || (spaceType === 'custom_space_type' && !customTypeName.trim()) || loading}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  spaceTypeContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  spaceTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  spaceTypeButton: {
    marginBottom: spacing.sm,
  },
  customTypeInput: {
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});

