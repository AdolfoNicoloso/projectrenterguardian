import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, ScrollableScreenContainer } from '../src/components';
import { spacing, typography } from '../src/theme';
import { useTheme } from '../src/theme/useTheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ScrollableScreenContainer
      includeBottomSafeArea={true}
      horizontalPadding={spacing.lg}
      topPadding={spacing.xl}
      bottomPadding={spacing.xl}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={Platform.OS === 'web'}
    >
      <View style={styles.content}>
        <Text style={[styles.slogan, { color: colors.text }]}>
          Inspect, Record, Protect, for free.
        </Text>

        <View style={styles.illustrationContainer}>
          <Image
            source={require('../assets/welcome-illustration.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        <PRGButton
          title="Start for free"
          onPress={() => router.push('/(auth)/signup')}
          variant="primary"
          style={styles.button}
        />

        <PRGButton
          title="Log in"
          onPress={() => router.push('/(auth)/login')}
          variant="secondary"
          style={styles.button}
        />
      </View>
    </ScrollableScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  slogan: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  illustrationContainer: {
    marginVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  illustration: {
    width: 300,
    height: 300,
    maxWidth: '100%',
  },
  button: {
    width: '100%',
    marginTop: spacing.md,
  },
});


