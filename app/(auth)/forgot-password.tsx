import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  PRGButton,
  PRGInput,
  PRGHeader,
  ScrollableScreenContainer,
} from '../../src/components';
import { firebaseAuth } from '../../src/services/firebase';
import { getAuthErrorMessage } from '../../src/utils/authErrors';
import { isRequired, isValidEmail } from '../../src/utils/validation';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/state/authStore';
import { goBackOr } from '../../src/navigation/goBackOr';
import { Routes } from '../../src/navigation/routes';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const existing = (user?.email || firebaseAuth.getCurrentUser()?.email || '').trim();
    if (existing) setEmail(existing);
  }, [user?.email]);

  const handleBack = () => {
    if (isAuthenticated) {
      goBackOr(router, Routes.PROFILE);
      return;
    }
    router.replace('/(auth)/login');
  };

  const handleSubmit = async () => {
    if (!isRequired(email)) {
      setError('Enter the email for your account.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await firebaseAuth.sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      // Do not reveal whether the email exists when Firebase returns user-not-found
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/user-not-found') {
        setSent(true);
      } else {
        setError(getAuthErrorMessage(err, 'Unable to send reset email. Try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="Reset password"
        showBack
        onBack={handleBack}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollableScreenContainer
          includeBottomSafeArea
          horizontalPadding={spacing.lg}
          topPadding={spacing.xl}
          bottomPadding={spacing.xl}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={Platform.OS === 'web'}
        >
          <View style={styles.content}>
            {sent ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  If an account exists for that address, we sent a link to reset your password.
                  The link may take a few minutes to arrive — also check spam or promotions.
                </Text>
                <PRGButton
                  title={isAuthenticated ? 'Back to profile' : 'Back to sign in'}
                  onPress={handleBack}
                  style={styles.button}
                  accessibilityLabel={isAuthenticated ? 'Back to profile' : 'Back to sign in'}
                />
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Forgot your password?</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  Enter your account email and we will send you a reset link.
                </Text>

                {error ? (
                  <Text
                    style={[styles.errorText, { color: colors.error }]}
                    accessibilityLiveRegion="polite"
                  >
                    {error}
                  </Text>
                ) : null}

                <PRGInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="Enter your email"
                />

                <PRGButton
                  title="Send reset link"
                  onPress={handleSubmit}
                  loading={loading}
                  style={styles.button}
                  accessibilityLabel="Send password reset link"
                />

                <PRGButton
                  title={isAuthenticated ? 'Back to profile' : 'Back to sign in'}
                  onPress={handleBack}
                  variant="ghost"
                  style={styles.button}
                  disabled={loading}
                />
              </>
            )}
          </View>
        </ScrollableScreenContainer>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
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
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
