import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer } from '../../src/components';
import { useAuthStore } from '../../src/state/authStore';
import { getAuthErrorMessage } from '../../src/utils/authErrors';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired, isValidPassword } from '../../src/utils/validation';

export default function SignUpScreen() {
  const router = useRouter();
  const { register, signInWithGoogle: signInWithGoogleStore } = useAuthStore();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isRequired(email) || !isRequired(password) || !isRequired(confirmPassword)) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isValidPassword(password, 8)) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register(email, password);
      // Use routing resolver instead of direct navigation
      const { resolvePostAuthRoute } = await import('../../src/utils/routingResolver');
      await resolvePostAuthRoute();
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await signInWithGoogleStore();
      // Use routing resolver instead of direct navigation
      const { resolvePostAuthRoute } = await import('../../src/utils/routingResolver');
      await resolvePostAuthRoute();
    } catch (err: any) {
      // If redirecting, don't show error (user will be redirected)
      if (err?.message === 'Redirecting to Google sign-in...') {
        // Keep loading state - user will be redirected
        return;
      }
      setError(getAuthErrorMessage(err, 'Google sign-in failed. Please try again.'));
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollableScreenContainer
        includeBottomSafeArea={true}
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign up for Renter Guardian</Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="Enter your email"
          />

          <PRGInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            placeholder="Enter your password"
          />

          <PRGInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            placeholder="Confirm your password"
          />

          <PRGButton
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={googleLoading}
            style={styles.button}
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <PRGButton
            title="Sign in with Google"
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={loading}
            variant="secondary"
            style={styles.button}
          />

          <PRGButton
            title="Back to Sign In"
            onPress={() => router.back()}
            variant="ghost"
            style={styles.button}
          />
        </View>
      </ScrollableScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

