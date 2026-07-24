import { Tabs, Redirect, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/state/authStore';
import { useTheme } from '../../src/theme/useTheme';
import { DesktopSideNav } from '../../src/components/DesktopSideNav';
import { NavTabIcon, NAV_ICON_SIZE } from '../../src/components/NavTabIcons';
import { useDesktopLayout } from '../../src/hooks/useDesktopLayout';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktopLayout();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
      {isDesktop ? <DesktopSideNav /> : null}
      <View style={[styles.main, { backgroundColor: themeColors.background }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: isDesktop
              ? { display: 'none', height: 0 }
              : {
                  backgroundColor: themeColors.background,
                  borderTopColor: themeColors.border,
                  borderTopWidth: 1,
                  height: 60 + insets.bottom,
                  paddingBottom: insets.bottom,
                  paddingTop: 8,
                  elevation: 0,
                  shadowOpacity: 0,
                },
            tabBarItemStyle: {
              paddingVertical: 0,
              justifyContent: 'center',
              alignItems: 'center',
            },
          }}
        >
          <Tabs.Screen
            name="rents"
            options={{
              title: 'Rents',
              tabBarAccessibilityLabel: 'Rents',
              tabBarIcon: ({ focused }) => (
                <NavTabIcon
                  name="rents"
                  focused={focused}
                  colors={themeColors}
                  size={NAV_ICON_SIZE.tab}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="tours"
            options={{
              title: 'Tours',
              tabBarAccessibilityLabel: 'Tours',
              tabBarIcon: ({ focused }) => (
                <NavTabIcon
                  name="tours"
                  focused={focused}
                  colors={themeColors}
                  size={NAV_ICON_SIZE.tab}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="inspections"
            listeners={{
              tabPress: () => {
                router.navigate('/(tabs)/inspections');
              },
            }}
            options={{
              title: 'Inspections',
              href: '/(tabs)/inspections',
              tabBarIcon: ({ focused }) => (
                <NavTabIcon
                  name="inspections"
                  focused={focused}
                  colors={themeColors}
                  size={NAV_ICON_SIZE.tab}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: 'Reports',
              tabBarAccessibilityLabel: 'Reports',
              tabBarIcon: ({ focused }) => (
                <NavTabIcon
                  name="insights"
                  focused={focused}
                  colors={themeColors}
                  size={NAV_ICON_SIZE.tab}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ focused }) => (
                <NavTabIcon
                  name="profile"
                  focused={focused}
                  colors={themeColors}
                  size={NAV_ICON_SIZE.tab}
                />
              ),
            }}
          />
          {/* Nested create/detail stack — not a primary tab. */}
          <Tabs.Screen
            name="properties"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="notifications"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  shellDesktop: {
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
});
