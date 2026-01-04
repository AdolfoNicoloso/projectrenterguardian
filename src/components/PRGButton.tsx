import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface PRGButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

export const PRGButton: React.FC<PRGButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textColor,
}) => {
  const { colors } = useTheme();
  
  const buttonStyle: ViewStyle[] = [styles.button];
  const textStyle: TextStyle[] = [styles.text];

  // Apply variant-specific styles
  if (variant === 'primary') {
    buttonStyle.push({ backgroundColor: colors.primary });
    textStyle.push({ color: colors.textInverse });
  } else if (variant === 'secondary') {
    buttonStyle.push({ 
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    });
    textStyle.push({ color: colors.primary });
  } else if (variant === 'ghost') {
    buttonStyle.push({ backgroundColor: 'transparent' });
    textStyle.push({ color: colors.primary });
  }

  if (disabled || loading) {
    buttonStyle.push(styles.disabled);
  }

  if (textColor) {
    textStyle.push({ color: textColor });
  }

  const indicatorColor = variant === 'primary' ? colors.textInverse : colors.primary;

  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
});


