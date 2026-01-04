import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface PRGBadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  style?: ViewStyle;
}

export const PRGBadge: React.FC<PRGBadgeProps> = ({
  label,
  variant = 'default',
  style,
}) => {
  const { colors } = useTheme();
  
  const getBackgroundColor = () => {
    if (variant === 'success') return colors.success + '20';
    if (variant === 'warning') return colors.warning + '20';
    if (variant === 'error') return colors.error + '20';
    return colors.border;
  };
  
  const getTextColor = () => {
    if (variant === 'success') return colors.success;
    if (variant === 'warning') return colors.warning;
    if (variant === 'error') return colors.error;
    return colors.textSecondary;
  };
  
  return (
    <View style={[styles.badge, { backgroundColor: getBackgroundColor() }, style]}>
      <Text style={[styles.text, { color: getTextColor() }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
});


