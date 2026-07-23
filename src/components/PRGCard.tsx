import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Platform } from 'react-native';
import { spacing } from '../theme';
import { useTheme } from '../theme/useTheme';

interface PRGCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'secondary';
  accessibilityLabel?: string;
}

export const PRGCard: React.FC<PRGCardProps> = ({ 
  children, 
  onPress, 
  style,
  variant = 'default',
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  const CardComponent = onPress ? TouchableOpacity : View;

  const shadowStyle = Platform.OS === 'web' 
    ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' as any }
    : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      };

  const cardStyle = [
    styles.card,
    shadowStyle,
    {
      backgroundColor: variant === 'secondary' ? colors.cardSecondary : colors.card,
    },
    style,
  ];

  return (
    <CardComponent
      style={cardStyle}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});


