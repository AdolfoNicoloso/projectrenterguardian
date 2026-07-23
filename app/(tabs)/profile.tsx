import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRGButton,
  PRGToast,
  PRGConfirmDialog,
  PRGLoadingOverlay,
  useToast,
  ScreenContainer,
} from '../../src/components';
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
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);

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
      setShowLogoutToast(true);
      setLogoutMessage('You have been successfully logged out');
      await logout(false);
      setAuthState(false, null);
      router.replace('/welcome');
    } catch (error) {
      console.error('Logout error:', error);
      setShowLogoutToast(true);
      setLogoutMessage('You have been successfully logged out');
      setAuthState(false, null);
      router.replace('/welcome');
    }
  };

  const finishAccountDeleted = async () => {
    setLogoutMessage('Your account has been deleted');
    try {
      await logout(false);
    } catch {
      // Auth user may already be gone
    }
    setAuthState(false, null);
    router.replace('/welcome');
  };

  const handleDeleteConfirmed = async () => {
    setConfirmDeleteStep(0);
    setDeleting(true);
    try {
      await appProfileService.deleteAccount();
      showToast('Account deleted', 'success');
      await finishAccountDeleted();
    } catch (error: any) {
      console.error('Delete account error:', error);
      showToast(error?.message || 'Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  return (
    <ScreenContainer includeBottomSafeArea={false}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
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
          disabled={deleting}
        />

        <PRGButton
          title="Delete Account"
          onPress={() => setConfirmDeleteStep(1)}
          variant="danger"
          style={styles.deleteButton}
          disabled={deleting}
          accessibilityLabel="Delete account"
          accessibilityHint="Permanently deletes your account and all data"
        />
      </ScrollView>

      <PRGConfirmDialog
        visible={confirmDeleteStep === 1}
        title="Delete account?"
        message="This will permanently remove your properties, photos, inspections, and profile."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmDeleteStep(0)}
        onConfirm={() => setConfirmDeleteStep(2)}
      />

      <PRGConfirmDialog
        visible={confirmDeleteStep === 2}
        title="Are you sure?"
        message="This is irreversible."
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmDeleteStep(0)}
        onConfirm={handleDeleteConfirmed}
      />

      <PRGToast
        message="You have been successfully logged out"
        type="success"
        visible={showLogoutToast}
        onHide={() => setShowLogoutToast(false)}
        duration={4000}
      />

      {deleting ? <PRGLoadingOverlay visible message="Deleting account…" /> : null}
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
  deleteButton: {
    marginTop: spacing.lg,
  },
});
