import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, LanguagePicker, ScrollableScreenContainer, useToast } from '../../src/components';
import { userPreferencesService } from '../../src/services/userPreferencesService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function OnboardingLanguageScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedLanguage) {
      showToast('Please select a language', 'error');
      return;
    }

    setLoading(true);

    try {
      await userPreferencesService.updateUserPreferences({ preferred_language: selectedLanguage });
      router.push('/onboarding/intent');
    } catch (err: any) {
      showToast(err.message || 'Failed to save language preference', 'error');
    } finally {
      setLoading(false);
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
            What is your preferred language?
          </Text>

          <LanguagePicker
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
            style={styles.picker}
          />

          <PRGButton
            title="Continue"
            onPress={handleContinue}
            loading={loading}
            disabled={!selectedLanguage}
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
  prompt: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  picker: {
    marginBottom: spacing.xl,
  },
  button: {
    marginTop: spacing.md,
  },
});

