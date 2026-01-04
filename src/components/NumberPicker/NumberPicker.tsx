import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { spacing, typography } from '../../theme';
import { Picker } from '@react-native-picker/picker';

interface NumberPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

/**
 * Cross-platform NumberPicker component for selecting a number from a range.
 * - Native (iOS/Android): Uses @react-native-picker/picker
 * - Web: Uses native select element
 */
export const NumberPicker: React.FC<NumberPickerProps> = ({
  value,
  onChange,
  label,
  min = 1,
  max = 36,
  disabled = false,
  error,
  placeholder,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);

  // Generate array of numbers from min to max
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Display text
  const displayText = value === 0
    ? 'Month-by-month'
    : value !== null 
      ? `${value}`
      : placeholder || 'Select number of months';

  const handleValueChange = (selectedValue: number) => {
    // -1 is used as a sentinel value for "empty" (null)
    onChange(selectedValue === -1 ? null : selectedValue);
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  const handlePress = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  // Native picker implementation (iOS/Android)
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled}
          style={[
            styles.input,
            {
              borderColor: error ? colors.error : colors.inputBorder,
              backgroundColor: disabled ? colors.backgroundTertiary : colors.inputBackground,
            },
            disabled && styles.disabled,
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.inputText,
              {
                color: value !== null ? colors.text : colors.inputPlaceholder,
              },
            ]}
          >
            {displayText}
          </Text>
        </TouchableOpacity>
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
        
        {showPicker && Platform.OS === 'android' && (
          <Picker
            selectedValue={value ?? -1}
            onValueChange={handleValueChange}
            style={styles.picker}
          >
            <Picker.Item key={-1} label={placeholder || 'Select number of months'} value={-1} />
            <Picker.Item key={0} label="Month-by-month" value={0} />
            {numbers.map((num) => (
              <Picker.Item key={num} label={`${num}`} value={num} />
            ))}
          </Picker>
        )}

        {Platform.OS === 'ios' && showPicker && (
          <Modal
            transparent
            visible={showPicker}
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowPicker(false)}
            >
              <View 
                style={[
                  styles.modalContent, 
                  { 
                    backgroundColor: colors.card,
                    paddingBottom: insets.bottom + spacing.md,
                  }
                ]}
                onStartShouldSetResponder={() => true}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity 
                    onPress={() => setShowPicker(false)}
                  >
                    <Text style={[styles.modalButton, { color: colors.primary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select Months</Text>
                  <TouchableOpacity
                    onPress={() => setShowPicker(false)}
                  >
                    <Text style={[styles.modalButton, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <Picker
                  selectedValue={value ?? -1}
                  onValueChange={handleValueChange}
                  style={styles.picker}
                >
                  <Picker.Item key={-1} label={placeholder || 'Select number of months'} value={-1} />
                  <Picker.Item key={0} label="Month-by-month" value={0} />
                  {numbers.map((num) => (
                    <Picker.Item key={num} label={`${num}`} value={num} />
                  ))}
                </Picker>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  }

  // Web implementation - use native select
  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.input,
          {
            borderColor: error ? colors.error : colors.inputBorder,
            backgroundColor: disabled ? colors.backgroundTertiary : colors.inputBackground,
          },
          disabled && styles.disabled,
        ]}
      >
        <select
          value={value ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === '' ? null : parseInt(val, 10));
          }}
          disabled={disabled}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: value !== null ? colors.text : colors.inputPlaceholder,
            fontSize: typography.fontSize.base,
            fontFamily: 'inherit',
            padding: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="">{placeholder || 'Select number of months'}</option>
          <option key={0} value={0}>
            Month-by-month
          </option>
          {numbers.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      </View>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: typography.fontSize.base,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  picker: {
    width: '100%',
  },
});


