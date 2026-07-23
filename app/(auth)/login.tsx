import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, PRGToast, ScrollableScreenContainer, PhoneAuthForm } from '../../src/components';
import { useAuthStore } from '../../src/state/authStore';
import { getAuthErrorMessage } from '../../src/utils/authErrors';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, signInWithGoogle: signInWithGoogleStore, completePhoneSignIn, logoutMessage, clearLogoutMessage } = useAuthStore();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [mode, setMode] = useState<'email' | 'phone'>('email');

  useEffect(() => {
    if (logoutMessage) {
      setShowLogoutToast(true);
      const timer = setTimeout(() => {
        setShowLogoutToast(false);
        clearLogoutMessage();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [logoutMessage, clearLogoutMessage]);

  const handleLogin = async () => {
    if (!isRequired(email) || !isRequired(password)) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(email, password);
      const { resolvePostAuthRoute } = await import('../../src/utils/routingResolver');
      await resolvePostAuthRoute();
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Sign-in failed. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await signInWithGoogleStore();
      const { resolvePostAuthRoute } = await import('../../src/utils/routingResolver');
      await resolvePostAuthRoute();
    } catch (err: any) {
      if (err?.message === 'Redirecting to Google sign-in...') {
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
          <Text style={[styles.title, { color: colors.text }]}>Renter Guardian</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to your account</Text>

          {error ? (
            <Text
              style={[styles.errorText, { color: colors.error }]}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.modeRow}>
            <PRGButton
              title="Email"
              onPress={() => {
                setMode('email');
                setError('');
              }}
              variant={mode === 'email' ? 'primary' : 'secondary'}
              style={styles.modeButton}
            />
            <PRGButton
              title="Phone"
              onPress={() => {
                setMode('phone');
                setError('');
              }}
              variant={mode === 'phone' ? 'primary' : 'secondary'}
              style={styles.modeButton}
            />
          </View>

          {mode === 'phone' ? (
            <PhoneAuthForm
              onError={setError}
              onSuccess={async () => {
                await completePhoneSignIn();
                const { resolvePostAuthRoute } = await import('../../src/utils/routingResolver');
                await resolvePostAuthRoute();
              }}
            />
          ) : (
            <>
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
                autoComplete="password"
                placeholder="Enter your password"
              />

              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                style={styles.forgotLink}
                accessibilityRole="link"
                accessibilityLabel="Forgot password"
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
              </Pressable>

              <PRGButton
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                disabled={googleLoading}
                style={styles.button}
              />
            </>
          )}

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
            title="Create Account"
            onPress={() => router.push('/(auth)/signup')}
            variant="ghost"
            style={styles.button}
          />
        </View>
      </ScrollableScreenContainer>

      {logoutMessage && (
        <PRGToast
          message={logoutMessage}
          type="success"
          visible={showLogoutToast}
          onHide={() => {
            setShowLogoutToast(false);
            clearLogoutMessage();
          }}
          duration={3000}
        />
      )}
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
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  forgotText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  button: {
    marginTop: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
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
    fontFamily: typography.fontFamily.medium,
  },
});
