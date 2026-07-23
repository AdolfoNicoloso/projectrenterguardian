import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, useToast } from '../../src/components';
import { appProfileService } from '../../src/services/appProfileService';
import { useAuthStore } from '../../src/state/authStore';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';

export default function OnboardingNameScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { logout } = useAuthStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleContinue = async () => {
    if (!isRequired(name)) {
      setError('Please enter your name');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await appProfileService.updateAppProfile({ name: name.trim() });
      router.push('/onboarding/intent');
    } catch (err: any) {
      setError(err.message || 'Failed to save name');
      showToast('Failed to save name', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout(false);
      router.replace('/welcome');
    } catch (err) {
      console.error('Logout error:', err);
      setLogoutLoading(false);
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
          <Text style={[styles.prompt, { color: colors.text }]}>
            What should we call you?
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            autoCapitalize="words"
            autoComplete="name"
            style={styles.input}
          />

          <PRGButton
            title="Continue"
            onPress={handleContinue}
            loading={loading}
            disabled={!name.trim() || logoutLoading}
            style={styles.button}
          />

          <PRGButton
            title="Sign Out"
            onPress={handleLogout}
            loading={logoutLoading}
            disabled={loading}
            variant="ghost"
            textColor={colors.error}
            style={styles.logoutButton}
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
  prompt: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.md,
  },
  logoutButton: {
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});

