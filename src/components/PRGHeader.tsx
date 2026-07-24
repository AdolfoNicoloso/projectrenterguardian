import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, layout } from '../theme';
import { useTheme } from '../theme/useTheme';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { goBackOr } from '../navigation/goBackOr';
import { Routes } from '../navigation/routes';

interface HeaderAction {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  variant?: 'text' | 'icon';
  accessibilityLabel?: string;
}

interface PRGHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Single right action (backward compatible). Ignored when rightActions is set. */
  rightAction?: HeaderAction;
  /** Multiple right actions (e.g. calendar + add). */
  rightActions?: HeaderAction[];
  onBack?: () => void;
}

export const PRGHeader: React.FC<PRGHeaderProps> = ({
  title,
  subtitle,
  showBack,
  rightAction,
  rightActions,
  onBack,
}) => {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const isDesktop = useDesktopLayout();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (showBack === true || canGoBack) {
      goBackOr(router, Routes.RENTS.LIST);
    }
  };

  // If showBack is explicitly true, always show it
  // Otherwise, only show if the router has history
  const shouldShowBack = showBack === true ? true : showBack === false ? false : canGoBack;
  const actions =
    rightActions && rightActions.length > 0
      ? rightActions
      : rightAction
        ? [rightAction]
        : [];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
          borderBottomColor: themeColors.border,
          paddingTop: isDesktop ? spacing.md : insets.top + spacing.sm,
        },
        isDesktop && styles.containerDesktop,
      ]}
    >
      <View
        style={[
          styles.content,
          isDesktop && styles.contentDesktop,
          isDesktop && { maxWidth: layout.contentMaxWidth },
        ]}
      >
        {/* Left: Back button (mobile) or back + title (desktop) */}
        {isDesktop ? (
          <View style={styles.desktopLeft}>
            {shouldShowBack ? (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Text style={[styles.backText, { color: themeColors.primary }]}>←</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.desktopTitleBlock}>
              <Text style={[styles.title, styles.titleDesktop, { color: themeColors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[styles.subtitle, styles.subtitleDesktop, { color: themeColors.textSecondary }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.left}>
              {shouldShowBack ? (
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.backButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Text style={[styles.backText, { color: themeColors.primary }]}>
                    {Platform.OS === 'ios' ? '‹' : '←'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.leftPlaceholder} />
              )}
            </View>

            <View style={styles.center}>
              <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && (
                <Text
                  style={[styles.subtitle, { color: themeColors.textSecondary }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </>
        )}

        {/* Right: Action button(s) */}
        <View style={[styles.right, actions.length > 1 && styles.rightWide, isDesktop && styles.rightDesktop]}>
          {actions.length > 0 ? (
            <View style={styles.rightActions}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={`${action.label || 'action'}-${index}`}
                  onPress={action.onPress}
                  style={styles.actionButton}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    action.accessibilityLabel || action.label || 'Header action'
                  }
                >
                  {action.icon ? (
                    action.icon
                  ) : (
                    <Text
                      style={[
                        styles.actionText,
                        { color: themeColors.primary },
                        action.variant === 'icon' && styles.actionIcon,
                      ]}
                    >
                      {action.label}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : isDesktop ? null : (
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
  },
  containerDesktop: {
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  contentDesktop: {
    width: '100%',
    paddingHorizontal: layout.contentGutter,
    minHeight: 52,
  },
  left: {
    width: 80,
    alignItems: 'flex-start',
  },
  leftPlaceholder: {
    width: 80,
  },
  desktopLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  desktopTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  right: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  rightDesktop: {
    minWidth: 0,
    flexShrink: 0,
  },
  rightWide: {
    minWidth: 112,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  titleDesktop: {
    textAlign: 'left',
    fontSize: typography.fontSize['2xl'],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs / 2,
    textAlign: 'center',
  },
  subtitleDesktop: {
    textAlign: 'left',
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
