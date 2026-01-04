import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface LanguageOption {
  value: string;
  label: string;
}

const LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
];

interface LanguagePickerProps {
  value?: string;
  onValueChange: (value: string) => void;
  style?: any;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  value,
  onValueChange,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {LANGUAGES.map((language) => {
        const isSelected = value === language.value;
        return (
          <TouchableOpacity
            key={language.value}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? colors.primary : 'transparent',
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onValueChange(language.value)}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color: isSelected ? colors.textInverse : colors.text,
                },
              ]}
            >
              {language.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  optionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
});


