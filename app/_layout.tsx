import 'react-native-gesture-handler';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/state/authStore';
import { checkGoogleRedirect } from '../src/services/googleAuth';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PRGToastProvider } from '../src/components';
import { NotificationsBootstrap } from '../src/components/NotificationsBootstrap';
import { ThemeProvider, useTheme } from '../src/theme';
import { typography } from '../src/theme/typography';
import { FONT_CONFIG } from '../src/theme/fonts';

function isPackagerDeepLink(urlOrPath: string | null | undefined): boolean {
  if (!urlOrPath) return false;
  return /127\.0\.0\.1|localhost|:\d{4}\b|expo-development-client|\/--\//i.test(urlOrPath);
}

function RootLayoutInner() {
  const { checkAuth, signInWithGoogle } = useAuthStore();
  const { isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Metro / press-i sometimes opens renterguardian://127.0.0.1:8081/--/... as a route.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (cancelled) return;
      if (isPackagerDeepLink(pathname) || isPackagerDeepLink(initialUrl)) {
        router.replace('/');
      }
    })();
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isPackagerDeepLink(url)) {
        router.replace('/');
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [pathname, router]);

  // Set global default font family for Text and TextInput components
  useEffect(() => {
    // Set default font family using defaultProps (React Native will merge these with component styles)
    if (!Text.defaultProps) {
      Text.defaultProps = {};
    }
    if (!Text.defaultProps.style) {
      Text.defaultProps.style = {};
    }
    // Only set if not already set
    if (!Text.defaultProps.style.fontFamily) {
      Text.defaultProps.style = { ...Text.defaultProps.style, fontFamily: typography.fontFamily.regular };
    }

    if (!TextInput.defaultProps) {
      TextInput.defaultProps = {};
    }
    if (!TextInput.defaultProps.style) {
      TextInput.defaultProps.style = {};
    }
    if (!TextInput.defaultProps.style.fontFamily) {
      TextInput.defaultProps.style = { ...TextInput.defaultProps.style, fontFamily: typography.fontFamily.regular };
    }
    
    // Load web fonts if on web platform
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Check if font link already exists to avoid duplicates
      if (!document.getElementById('app-font-link')) {
        // Load Google Fonts for Open Sans
        const link = document.createElement('link');
        link.id = 'app-font-link';
        link.rel = 'stylesheet';
        link.href = FONT_CONFIG.webFontUrl;
        document.head.appendChild(link);
      }
      
      // Check if font styles already exist to avoid duplicates
      if (!document.getElementById('app-font-styles')) {
        const style = document.createElement('style');
        style.id = 'app-font-styles';
        style.textContent = `
          html, body, #root {
            height: 100%;
            margin: 0;
          }
          body, input, textarea, select, button {
            font-family: ${FONT_CONFIG.regular} !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      // Check for Google redirect result on web
      if (Platform.OS === 'web') {
        try {
          const result = await checkGoogleRedirect();
          if (result) {
            // User is already authenticated from redirect, just update state
            await checkAuth();
          }
        } catch (error) {
          console.error('Error checking Google redirect:', error);
        }
      }
      // Check existing auth state
      await checkAuth();
    };

    initializeAuth();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PRGToastProvider>
        <NotificationsBootstrap>
          <Stack
            screenOptions={{
              headerShown: false,
              // Note: Using native iOS animations (default behavior)
              // Do not add custom animation/presentation settings here
              // iOS native stack animations (slide from right/pop to right) are preferred
            }}
          >
            <Stack.Screen name="welcome" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="invite/[token]" />
            <Stack.Screen name="share/[token]" />
            <Stack.Screen name="legal/[doc]" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </NotificationsBootstrap>
      </PRGToastProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
