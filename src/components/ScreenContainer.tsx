import React from 'react';
import { View, ScrollView, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * Whether to include top safe area padding (default: true)
   * Set to false if you're handling top padding manually (e.g., with a header component)
   */
  includeTopSafeArea?: boolean;
  /**
   * Whether to include bottom safe area padding (default: true)
   * Set to false if you're handling bottom padding manually (e.g., with a tab bar)
   */
  includeBottomSafeArea?: boolean;
  /**
   * Horizontal padding (default: spacing.md = 16pt)
   * Set to 0 if you want edge-to-edge content
   */
  horizontalPadding?: number;
  /**
   * Additional top padding beyond safe area (default: 0)
   * Use this for spacing after headers, etc.
   */
  topPadding?: number;
  /**
   * Additional bottom padding beyond safe area (default: 0)
   * Use this for spacing before tab bars, etc.
   */
  bottomPadding?: number;
  /**
   * Whether the container should be scrollable
   * If true, children should be wrapped in ScrollView manually
   */
  scrollable?: boolean;
}

/**
 * ScreenContainer - A reusable container component that properly handles safe areas
 * and provides consistent spacing across all screens.
 * 
 * Usage:
 * ```tsx
 * <ScreenContainer>
 *   <Text>Content here</Text>
 * </ScreenContainer>
 * 
 * // For screens with headers (header handles top padding):
 * <ScreenContainer includeTopSafeArea={false}>
 *   <Header />
 *   <Content />
 * </ScreenContainer>
 * 
 * // For scrollable content:
 * <ScreenContainer>
 *   <ScrollView contentContainerStyle={styles.scrollContent}>
 *     <Content />
 *   </ScrollView>
 * </ScreenContainer>
 * ```
 */
export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  includeTopSafeArea = true,
  includeBottomSafeArea = true,
  horizontalPadding = spacing.md,
  topPadding = 0,
  bottomPadding = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: themeColors.background,
    paddingTop: includeTopSafeArea ? insets.top + topPadding : topPadding,
    paddingBottom: includeBottomSafeArea ? insets.bottom + bottomPadding : bottomPadding,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
  };

  return (
    <View style={[containerStyle, style]}>
      {children}
    </View>
  );
};

/**
 * ScrollableScreenContainer - A variant that includes a ScrollView
 * Use this when you need scrollable content with safe area padding
 */
interface ScrollableScreenContainerProps extends Omit<ScreenContainerProps, 'scrollable'> {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  /**
   * Additional bottom padding for scroll content (default: spacing.lg)
   * Ensures content isn't cut off when scrolling to the bottom
   */
  scrollBottomPadding?: number;
  /**
   * Whether scrolling is enabled (default: true)
   */
  scrollEnabled?: boolean;
}

export const ScrollableScreenContainer: React.FC<ScrollableScreenContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  includeTopSafeArea = true,
  includeBottomSafeArea = true,
  horizontalPadding = spacing.md,
  topPadding = 0,
  bottomPadding = 0,
  scrollBottomPadding = spacing.lg,
  scrollEnabled = true,
}) => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: themeColors.background,
    paddingTop: includeTopSafeArea ? insets.top + topPadding : topPadding,
    paddingBottom: 0, // ScrollView handles bottom padding in contentContainerStyle
    paddingLeft: 0, // ScrollView handles horizontal padding in contentContainerStyle
    paddingRight: 0,
  };

  const scrollContentStyle: ViewStyle = {
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    paddingBottom: includeBottomSafeArea 
      ? insets.bottom + bottomPadding + scrollBottomPadding
      : bottomPadding + scrollBottomPadding,
    flexGrow: 1,
  };

  return (
    <View style={[containerStyle, style]}>
      <ScrollView
        contentContainerStyle={[scrollContentStyle, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    </View>
  );
};

