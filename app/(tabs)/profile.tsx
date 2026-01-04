import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRGButton, PRGToast, useToast, ScreenContainer } from '../../src/components';
import { useAuthStore } from '../../src/state/authStore';
import { useRouter } from 'expo-router';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { appProfileService } from '../../src/services/appProfileService';
import type { AppProfile } from '../../src/types';

export default function ProfileScreen() {
  const { user, logout, setAuthState, setLogoutMessage } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [appProfile, setAppProfile] = useState<AppProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await appProfileService.getAppProfile();
        setAppProfile(profile);
      } catch (error) {
        console.error('Failed to load app profile:', error);
      }
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    try {
      // Show success message
      setShowLogoutToast(true);
      setLogoutMessage('You have been successfully logged out');
      
      // Perform logout immediately
      await logout(false);
      
      // Immediately update auth state and redirect
        setAuthState(false, null);
        router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, show message and redirect
      setShowLogoutToast(true);
      setLogoutMessage('You have been successfully logged out');
        setAuthState(false, null);
        router.replace('/(auth)/login');
    }
  };

  return (
    <ScreenContainer includeBottomSafeArea={false}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        {user && (
          <>
            {appProfile?.name && (
              <View style={styles.info}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Name:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{appProfile.name}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{user.email || 'N/A'}</Text>
            </View>
          </>
        )}

        <PRGButton
          title="Sign Out"
          onPress={handleLogout}
          variant="secondary"
          style={styles.button}
        />
      </ScrollView>
      
      <PRGToast
        message="You have been successfully logged out"
        type="success"
        visible={showLogoutToast}
        onHide={() => setShowLogoutToast(false)}
        duration={4000}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  info: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
  },
  button: {
    marginTop: spacing.md,
  },
});


