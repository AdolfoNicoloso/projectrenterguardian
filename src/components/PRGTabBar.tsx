import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { useDesktopLayout } from '../hooks/useDesktopLayout';

interface Tab {
  id: string;
  label: string;
}

interface PRGTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const PRGTabBar: React.FC<PRGTabBarProps> = ({ tabs, activeTab, onTabChange }) => {
  const { colors } = useTheme();
  const isDesktop = useDesktopLayout();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
        isDesktop && styles.containerDesktop,
      ]}
    >
      <View style={[styles.row, isDesktop && styles.rowDesktop]}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                isDesktop && styles.tabDesktop,
                isActive && { borderBottomColor: colors.primary },
              ]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  isActive && {
                    color: colors.primary,
                    fontWeight: typography.fontWeight.semibold,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  containerDesktop: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  rowDesktop: {
    width: '100%',
    maxWidth: 1120,
    paddingHorizontal: 32,
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabDesktop: {
    flex: 0,
    paddingHorizontal: spacing.md,
    minWidth: 96,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
  },
});
