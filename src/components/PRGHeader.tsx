import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface PRGHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: {
    label?: string;
    icon?: React.ReactNode;
    onPress: () => void;
    variant?: 'text' | 'icon';
  };
  onBack?: () => void;
}

export const PRGHeader: React.FC<PRGHeaderProps> = ({
  title,
  subtitle,
  showBack,
  rightAction,
  onBack,
}) => {
  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    
    // Use router.back() for proper native iOS backward animation
    // This uses the native navigation stack animation
    if (canGoBack) {
      router.back();
      return;
    }
    
    // Fallback: if we can't go back but showBack is true, navigate to properties list
    // This handles cases where navigation stack isn't properly initialized
    if (showBack === true) {
      router.push('/(tabs)/properties');
    }
  };

  // If showBack is explicitly true, always show it
  // Otherwise, only show if navigation.canGoBack() is true
  const shouldShowBack = showBack === true ? true : (showBack === false ? false : canGoBack);

  return (
    <View style={[styles.container, { 
      backgroundColor: themeColors.background,
      borderBottomColor: themeColors.border,
      paddingTop: insets.top + spacing.sm,
    }]}>
      <View style={styles.content}>
        {/* Left: Back button */}
        <View style={styles.left}>
          {shouldShowBack ? (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.backText, { color: themeColors.primary }]}>
                {Platform.OS === 'ios' ? '‹' : '←'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.leftPlaceholder} />
          )}
        </View>

        {/* Center: Title and subtitle */}
        <View style={styles.center}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right: Action button */}
        <View style={styles.right}>
          {rightAction ? (
            <TouchableOpacity
              onPress={rightAction.onPress}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {rightAction.icon ? (
                rightAction.icon
              ) : (
                <Text
                  style={[
                    styles.actionText,
                    { color: themeColors.primary },
                    rightAction.variant === 'icon' && styles.actionIcon,
                  ]}
                >
                  {rightAction.label}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.rightPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    // paddingTop is set dynamically via style prop to include safe area insets
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  left: {
    width: 80,
    alignItems: 'flex-start',
  },
  leftPlaceholder: {
    width: 80,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  right: {
    width: 80,
    alignItems: 'flex-end',
  },
  rightPlaceholder: {
    width: 80,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  backText: {
    fontSize: Platform.OS === 'ios' ? 28 : typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
    lineHeight: Platform.OS === 'ios' ? 28 : undefined,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs / 2,
    textAlign: 'center',
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
  actionIcon: {
    fontSize: typography.fontSize.xl,
  },
});

