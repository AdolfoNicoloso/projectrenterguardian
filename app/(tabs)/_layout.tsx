import { Tabs, Redirect, router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/state/authStore';
import { useTheme } from '../../src/theme/useTheme';
import { getNavIcon } from '../../src/navigation/navIcon';
import { SVGIcon } from '../../src/components/SVGIcon';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { theme, colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  // Responsive icon size: scales with screen width but with constraints
  // Base size: 28px, scales slightly for larger screens, minimum 26px, maximum 32px
  const iconSize = Math.max(26, Math.min(32, width * 0.075));

  if (isLoading) {
    return null; // Or a loading screen
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Hide text labels, show only icons
        tabBarStyle: {
          backgroundColor: themeColors.background,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom, // Base height + safe area bottom
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0, // Remove shadow on Android
          shadowOpacity: 0, // Remove shadow on iOS
        },
        tabBarItemStyle: {
          paddingVertical: 0, // Remove vertical padding to prevent clipping
          justifyContent: 'center', // Center icons vertically
          alignItems: 'center', // Center icons horizontally
        },
      }}
    >
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => {
            const IconComponent = getNavIcon('properties', focused, theme);
            return <SVGIcon source={IconComponent} size={focused ? iconSize + 4 : iconSize} />;
          },
        }}
      />
      <Tabs.Screen
        name="inspections"
        listeners={{
          tabPress: () => {
            // Always land on the Inspections list, not a leftover "new"/wizard screen.
            router.navigate('/(tabs)/inspections');
          },
        }}
        options={{
          title: 'Inspections',
          href: '/(tabs)/inspections',
          tabBarIcon: ({ focused }) => {
            const IconComponent = getNavIcon('inspections', focused, theme);
            return <SVGIcon source={IconComponent} size={focused ? iconSize + 4 : iconSize} />;
          },
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Reports',
          tabBarAccessibilityLabel: 'Reports',
          tabBarIcon: ({ focused }) => {
            const IconComponent = getNavIcon('insights', focused, theme);
            return <SVGIcon source={IconComponent} size={focused ? iconSize + 4 : iconSize} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => {
            const IconComponent = getNavIcon('profile', focused, theme);
            return <SVGIcon source={IconComponent} size={focused ? iconSize + 4 : iconSize} />;
          },
        }}
      />
    </Tabs>
  );
}
