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
import { useDesktopLayout } from '../src/hooks/useDesktopLayout';
import { spacing, typography } from '../src/theme';
import { useTheme } from '../src/theme/useTheme';

/**
 * Pre-auth landing: brand, logo, value prop, Get Started.
 * Mobile: stacked phone layout. Desktop web: illustration | brand+CTA.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { height } = useWindowDimensions();
  const isDesktop = useDesktopLayout();

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

  const brandBlock = (
    <Animated.View
      style={[
        styles.brandBlock,
        isDesktop && styles.brandBlockDesktop,
        {
          opacity: brandOpacity,
          transform: [{ translateY: brandY }],
        },
      ]}
    >
      <Image
        source={require('../assets/favicon.png')}
        style={[styles.logo, isDesktop && styles.logoDesktop]}
        resizeMode="contain"
        accessibilityLabel="Renter Guardian logo"
      />
      <Text
        style={[styles.brandName, isDesktop && styles.brandNameDesktop, { color: colors.text }]}
        accessibilityRole="header"
      >
        Renter Guardian
      </Text>
      <Text
        style={[
          styles.valueProp,
          isDesktop && styles.valuePropDesktop,
          { color: colors.textSecondary },
        ]}
      >
        Document every space. Protect your deposit.
      </Text>
    </Animated.View>
  );

  const heroBlock = (
    <Animated.View
      style={[
        styles.heroBlock,
        isDesktop && styles.heroBlockDesktop,
        {
          opacity: heroOpacity,
          transform: [{ translateY: heroY }],
        },
      ]}
    >
      <Image
        source={require('../assets/welcome-illustration.jpg')}
        style={[styles.heroImage, isDesktop && styles.heroImageDesktop]}
        resizeMode="contain"
        accessibilityLabel="Inspector with checklist illustration"
      />
    </Animated.View>
  );

  const ctaBlock = (
    <Animated.View
      style={[
        styles.ctaBlock,
        isDesktop && styles.ctaBlockDesktop,
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
  );

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
        horizontalPadding={isDesktop ? spacing['2xl'] : spacing.lg}
        topPadding={isDesktop ? spacing['2xl'] : spacing.xl}
        bottomPadding={isDesktop ? spacing['2xl'] : spacing.xl}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: Math.max(height - 48, isDesktop ? 640 : 560) },
        ]}
        scrollEnabled={Platform.OS === 'web'}
      >
        {isDesktop ? (
          <View style={styles.desktopSplit}>
            {heroBlock}
            <View style={styles.desktopCopy}>
              {brandBlock}
              {ctaBlock}
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            {brandBlock}
            {heroBlock}
            {ctaBlock}
          </View>
        )}
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
  desktopSplit: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['3xl'],
    flex: 1,
    paddingVertical: spacing.xl,
  },
  desktopCopy: {
    flex: 1,
    maxWidth: 440,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    width: '100%',
    paddingTop: spacing.md,
  },
  brandBlockDesktop: {
    alignItems: 'center',
    paddingTop: 0,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: spacing.md,
  },
  logoDesktop: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  brandName: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  brandNameDesktop: {
    textAlign: 'center',
    fontSize: 48,
    lineHeight: 54,
  },
  valueProp: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  valuePropDesktop: {
    textAlign: 'center',
    maxWidth: 400,
    fontSize: typography.fontSize.xl,
    lineHeight: 30,
  },
  heroBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginVertical: spacing.lg,
  },
  heroBlockDesktop: {
    flex: 1.1,
    flexGrow: 1,
    marginVertical: 0,
    maxWidth: 520,
  },
  heroImage: {
    width: '100%',
    maxWidth: 340,
    height: 280,
  },
  heroImageDesktop: {
    maxWidth: 480,
    height: 420,
  },
  ctaBlock: {
    width: '100%',
    paddingBottom: spacing.sm,
  },
  ctaBlockDesktop: {
    paddingBottom: 0,
    maxWidth: 320,
    alignSelf: 'center',
    width: '100%',
  },
  primaryCta: {
    width: '100%',
  },
  secondaryCta: {
    width: '100%',
    marginTop: spacing.sm,
  },
});
