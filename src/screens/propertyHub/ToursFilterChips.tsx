import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { propertyHubStyles as styles } from './propertyHubStyles';
import { TOURS_FILTER_TAGS, type ToursListFilter } from './types';

type ToursFilterChipsProps = {
  selected: ToursListFilter[];
  onToggle: (id: ToursListFilter) => void;
};

/**
 * Chip row for Tours hub filters (scheduled / toured / applied).
 */
export function ToursFilterChips({ selected, onToggle }: ToursFilterChipsProps) {
  const { colors } = useTheme();

  return (
    <View
      style={styles.filterRow}
      accessibilityRole="tablist"
      accessibilityLabel="Filter tours"
    >
      {TOURS_FILTER_TAGS.map((tag) => {
        const isSelected = selected.includes(tag.id);
        return (
          <Pressable
            key={tag.id}
            onPress={() => onToggle(tag.id)}
            style={({ pressed }) => [
              styles.filterChip,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected
                  ? colors.primary + '18'
                  : colors.backgroundSecondary,
              },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Filter ${tag.label}`}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: isSelected ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              {tag.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
