/**
 * Centers and constrains page content on desktop web.
 * On mobile / native it is a transparent pass-through wrapper.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { layout } from '../theme/layout';

type WebPageFrameProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override default content max width (e.g. forms). */
  maxWidth?: number;
  /** When false, fill the canvas edge-to-edge (rare; most screens want the frame). */
  constrain?: boolean;
};

export function WebPageFrame({
  children,
  style,
  maxWidth = layout.contentMaxWidth,
  constrain = true,
}: WebPageFrameProps) {
  const isDesktop = useDesktopLayout();

  if (!isDesktop || !constrain) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  return (
    <View style={[styles.outer, style]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

/** Style helper for ScrollView/FlatList contentContainerStyle on desktop. */
export function useWebPageContentStyle(
  base?: StyleProp<ViewStyle>,
  maxWidth: number = layout.contentMaxWidth
): StyleProp<ViewStyle> {
  const isDesktop = useDesktopLayout();
  if (!isDesktop) return base;
  return [
    base,
    {
      width: '100%',
      maxWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.contentGutter,
    },
  ];
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    paddingHorizontal: layout.contentGutter,
  },
});
