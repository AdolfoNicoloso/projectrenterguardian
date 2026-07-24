import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { PRGButton } from './PRGButton';

interface PRGEditableTextRowProps {
  label: string;
  value: string;
  /**
   * Shown when not editing. Use when the stored value is empty but a
   * fallback (e.g. full address) should appear as the current label.
   */
  displayValue?: string;
  onSave?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  /** When true, empty values may be saved (cleared). */
  allowEmpty?: boolean;
  /** Lines for the read-only value (default 1). */
  numberOfLines?: number;
}

export const PRGEditableTextRow: React.FC<PRGEditableTextRowProps> = ({
  label,
  value,
  displayValue,
  onSave,
  placeholder,
  editable = true,
  required = false,
  autoCapitalize = 'words',
  maxLength,
  allowEmpty = false,
  numberOfLines = 1,
}) => {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const shownValue = (displayValue ?? value).trim();

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }
    const next = editValue.trim();
    if (!next && !allowEmpty) {
      return;
    }
    onSave(next);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (editable) {
            setEditValue(value);
            setIsEditing(true);
          }
        }}
        disabled={!editable}
        activeOpacity={editable ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
        <View style={styles.valueRow}>
          <Text
            style={[
              styles.value,
              { color: shownValue ? colors.text : colors.inputPlaceholder },
              !shownValue && styles.valuePlaceholder,
              styles.valueFlex,
            ]}
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
          >
            {shownValue || placeholder || 'Tap to edit'}
          </Text>
          {editable && (
            <Text style={[styles.editHint, { color: colors.primary }]} numberOfLines={1}>
              Tap to edit
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
          },
        ]}
        value={editValue}
        onChangeText={setEditValue}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        autoFocus
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
      <View style={styles.editActions}>
        <PRGButton
          title="Cancel"
          onPress={handleCancel}
          variant="ghost"
          style={styles.actionButton}
        />
        <PRGButton
          title="Save"
          onPress={handleSave}
          variant="primary"
          style={styles.actionButton}
          disabled={!allowEmpty && !editValue.trim()}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
  valueFlex: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  valuePlaceholder: {
    fontStyle: 'italic',
  },
  editHint: {
    flexShrink: 0,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },
  input: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    minWidth: 80,
  },
});

