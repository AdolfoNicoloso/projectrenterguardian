import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer } from '../src/components';
import { spacing, typography } from '../src/theme';
import { useTheme } from '../src/theme/useTheme';

/**
 * Pre-auth landing: brand, logo, value prop, Get Started.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { height } = useWindowDimensions();

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(16)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(24)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.stagger(140, [
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(brandY, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 560,
          useNativeDriver: true,
        }),
        Animated.timing(heroY, {
          toValue: 0,
          duration: 560,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 440,
          useNativeDriver: true,
        }),
        Animated.timing(ctaY, {
          toValue: 0,
          duration: 440,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [brandOpacity, brandY, heroOpacity, heroY, ctaOpacity, ctaY]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Soft brand atmosphere (no flat single-color field) */}
      <View
        pointerEvents="none"
        style={[
          styles.glowTop,
          {
            backgroundColor: isDark ? 'rgba(111, 0, 255, 0.22)' : 'rgba(111, 0, 255, 0.10)',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowBottom,
          {
            backgroundColor: isDark ? 'rgba(139, 95, 255, 0.14)' : 'rgba(157, 78, 221, 0.08)',
          },
        ]}
      />

      <ScrollableScreenContainer
        includeBottomSafeArea
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: Math.max(height - 48, 560) },
        ]}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.brandBlock,
              {
                opacity: brandOpacity,
                transform: [{ translateY: brandY }],
              },
            ]}
          >
            <Image
              source={require('../assets/favicon.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Renter Guardian logo"
            />
            <Text
              style={[styles.brandName, { color: colors.text }]}
              accessibilityRole="header"
            >
              Renter Guardian
            </Text>
            <Text style={[styles.valueProp, { color: colors.textSecondary }]}>
              Document every space. Protect your deposit.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.heroBlock,
              {
                opacity: heroOpacity,
                transform: [{ translateY: heroY }],
              },
            ]}
          >
            <Image
              source={require('../assets/welcome-illustration.png')}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityLabel="Inspector with checklist illustration"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.ctaBlock,
              {
                opacity: ctaOpacity,
                transform: [{ translateY: ctaY }],
              },
            ]}
          >
            <PRGButton
              title="Get Started"
              onPress={() => router.push('/(auth)/signup')}
              variant="primary"
              style={styles.primaryCta}
              accessibilityLabel="Get started"
              accessibilityHint="Create an account to begin"
            />
            <PRGButton
              title="Sign in"
              onPress={() => router.push('/(auth)/login')}
              variant="ghost"
              style={styles.secondaryCta}
              accessibilityLabel="Sign in to existing account"
            />
          </Animated.View>
        </View>
      </ScrollableScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    width: '100%',
    paddingTop: spacing.md,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: spacing.md,
  },
  brandName: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  valueProp: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  heroBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginVertical: spacing.lg,
  },
  heroImage: {
    width: '100%',
    maxWidth: 340,
    height: 280,
  },
  ctaBlock: {
    width: '100%',
    paddingBottom: spacing.sm,
  },
  primaryCta: {
    width: '100%',
  },
  secondaryCta: {
    width: '100%',
    marginTop: spacing.sm,
  },
});
