import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRGButton,
  PRGToast,
  PRGConfirmDialog,
  // DO NOT REMOVE CODE — also used when Delete Account UI is restored
  PRGLoadingOverlay,
  PRGHeader,
  useToast,
  ScreenContainer,
  NotificationsBellGlyph,
  NotificationsBellButton,
  useWebPageContentStyle,
} from '../../src/components';
import { useAuthStore } from '../../src/state/authStore';
import { useRouter } from 'expo-router';
import { spacing, typography, layout } from '../../src/theme';
import { useTheme, type ThemePreference } from '../../src/theme/useTheme';
import { useDesktopLayout } from '../../src/hooks/useDesktopLayout';
import { appProfileService } from '../../src/services/appProfileService';
import { firebaseAuth } from '../../src/services/firebase';
import { getAuthErrorMessage } from '../../src/utils/authErrors';
import type { AppProfile } from '../../src/types';
import { Routes } from '../../src/navigation/routes';
import {
  APP_DISPLAY_NAME,
  APP_VERSION,
  SUPPORT_EMAIL,
  LEGAL_DOCUMENTS,
  type LegalDocId,
} from '../../src/constants/legal';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'auto', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function getSignInProviderIds(): string[] {
  const current = firebaseAuth.getCurrentUser();
  return (current?.providerData || [])
    .map((p) => p.providerId)
    .filter(Boolean);
}

function accountHasPasswordSignIn(): boolean {
  return getSignInProviderIds().includes('password');
}

function accountUsesGoogleSignIn(): boolean {
  return getSignInProviderIds().includes('google.com');
}

function initialsFromName(name?: string | null, email?: string | null): string {
  const trimmed = (name || '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const e = (email || '').trim();
  return e ? e.slice(0, 2).toUpperCase() : 'RG';
}

function SettingsRow({
  title,
  subtitle,
  onPress,
  showChevron = true,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        {
          backgroundColor: pressed ? colors.border + '66' : 'transparent',
          borderBottomColor: colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.settingsRowText}>
        <Text style={[styles.settingsRowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.settingsRowSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showChevron ? (
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
      ) : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, setAuthState, setLogoutMessage } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useTheme();
  const isDesktop = useDesktopLayout();
  const { showToast } = useToast();
  const scrollContentStyle = useWebPageContentStyle(styles.scrollContent, layout.formMaxWidth);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [appProfile, setAppProfile] = useState<AppProfile | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [confirmResetVisible, setConfirmResetVisible] = useState(false);

  // DO NOT REMOVE CODE — account deletion temporarily disabled in UI.
  // Keep confirm + delete handlers for a future re-enable.
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  void confirmDeleteStep;
  void setConfirmDeleteStep;

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

  // DO NOT REMOVE CODE — account deletion flow (UI button removed).
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

  // DO NOT REMOVE CODE — account deletion flow (UI button removed).
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
  void handleDeleteConfirmed;

  const openLegalDoc = useCallback(
    (doc: LegalDocId) => {
      const entry = LEGAL_DOCUMENTS[doc];
      if (entry.url) {
        void Linking.openURL(entry.url);
        return;
      }
      router.push(Routes.LEGAL.DOC(doc) as never);
    },
    [router]
  );

  const openSupportEmail = async () => {
    const subject = encodeURIComponent(`${APP_DISPLAY_NAME} support`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can && Platform.OS !== 'web') {
        showToast(`Email us at ${SUPPORT_EMAIL}`, 'info');
        return;
      }
      await Linking.openURL(url);
    } catch {
      showToast(`Email us at ${SUPPORT_EMAIL}`, 'info');
    }
  };

  const openPasswordReset = () => {
    const accountEmail = (user?.email || '').trim();
    if (!accountEmail) {
      showToast('No email is linked to this account.', 'error');
      return;
    }

    // Google-only accounts manage their Google password at Google — explain before sending.
    if (accountUsesGoogleSignIn() && !accountHasPasswordSignIn()) {
      setConfirmResetVisible(true);
      return;
    }

    setConfirmResetVisible(true);
  };

  const sendPasswordResetToAccountEmail = async () => {
    setConfirmResetVisible(false);
    const accountEmail = (user?.email || '').trim();
    if (!accountEmail) {
      showToast('No email is linked to this account.', 'error');
      return;
    }

    setSendingReset(true);
    try {
      await firebaseAuth.sendPasswordReset(accountEmail);
      showToast(`Reset link sent to ${accountEmail}. Check inbox and spam.`, 'success');
    } catch (error) {
      console.error('Password reset error:', error);
      showToast(
        getAuthErrorMessage(error, 'Unable to send reset email. Try again.'),
        'error'
      );
    } finally {
      setSendingReset(false);
    }
  };

  const onSelectTheme = async (next: ThemePreference) => {
    if (savingTheme || next === (preference || 'auto')) return;
    setSavingTheme(true);
    try {
      await setPreference(next);
    } catch (error) {
      console.error('Theme preference error:', error);
      showToast('Could not update appearance', 'error');
    } finally {
      setSavingTheme(false);
    }
  };

  const displayName = appProfile?.name?.trim() || null;
  const email = user?.email || 'N/A';
  const initials = initialsFromName(displayName, user?.email);
  const activeTheme = preference || 'auto';

  return (
    <ScreenContainer
      includeTopSafeArea={!isDesktop}
      includeBottomSafeArea={false}
      horizontalPadding={isDesktop ? 0 : undefined}
    >
      {isDesktop ? (
        <PRGHeader
          title="Profile"
          showBack={false}
          rightAction={{
            icon: <NotificationsBellGlyph />,
            onPress: () => router.push(Routes.NOTIFICATIONS as never),
            accessibilityLabel: 'Open notifications',
          }}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[
          scrollContentStyle,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isDesktop ? (
          <View style={styles.mobileTitleRow}>
            <Text style={[styles.pageTitle, styles.titleInRow, { color: colors.text }]}>
              Profile
            </Text>
            <NotificationsBellButton />
          </View>
        ) : null}

        {/* Account */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.accountHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
            <View style={styles.accountText}>
              <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
                {displayName || 'Your account'}
              </Text>
              <Text style={[styles.accountEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Settings</Text>
        <View
          style={[
            styles.card,
            styles.cardFlush,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.themeBlock, { borderBottomColor: colors.border }]}>
            <Text style={[styles.settingsRowTitle, { color: colors.text }]}>Appearance</Text>
            <Text style={[styles.settingsRowSubtitle, { color: colors.textSecondary }]}>
              Choose light, dark, or match your device
            </Text>
            <View style={styles.themeSegment}>
              {THEME_OPTIONS.map((opt) => {
                const selected = activeTheme === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => void onSelectTheme(opt.value)}
                    disabled={savingTheme}
                    style={[
                      styles.themeChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Appearance ${opt.label}`}
                  >
                    <Text
                      style={[
                        styles.themeChipText,
                        { color: selected ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <SettingsRow
            title="Reset password"
            subtitle={
              sendingReset
                ? 'Sending reset email…'
                : accountUsesGoogleSignIn() && !accountHasPasswordSignIn()
                  ? 'Email a link to add or reset an email password'
                  : `Send a reset link to ${email}`
            }
            onPress={openPasswordReset}
          />
        </View>

        {/* Legal & agreements — commercial apps pattern */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Legal & agreements
        </Text>
        <View
          style={[
            styles.card,
            styles.cardFlush,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <SettingsRow
            title={LEGAL_DOCUMENTS.privacy.title}
            subtitle={LEGAL_DOCUMENTS.privacy.subtitle}
            onPress={() => openLegalDoc('privacy')}
          />
          <SettingsRow
            title={LEGAL_DOCUMENTS.terms.title}
            subtitle={LEGAL_DOCUMENTS.terms.subtitle}
            onPress={() => openLegalDoc('terms')}
          />
          <SettingsRow
            title={LEGAL_DOCUMENTS.notices.title}
            subtitle={LEGAL_DOCUMENTS.notices.subtitle}
            onPress={() => openLegalDoc('notices')}
          />
        </View>

        {/* Support */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Support</Text>
        <View
          style={[
            styles.card,
            styles.cardFlush,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <SettingsRow
            title="Contact support"
            subtitle={SUPPORT_EMAIL}
            onPress={() => void openSupportEmail()}
          />
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>About</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.aboutRow}>
            <Text style={[styles.settingsRowTitle, { color: colors.text }]}>
              {APP_DISPLAY_NAME}
            </Text>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              Version {APP_VERSION}
            </Text>
          </View>
          <Text style={[styles.aboutFinePrint, { color: colors.textTertiary }]}>
            By using {APP_DISPLAY_NAME}, you agree to our Terms of Service and acknowledge
            our Privacy Policy and Important notices.
          </Text>
        </View>

        <PRGButton
          title="Sign Out"
          onPress={handleLogout}
          variant="secondary"
          style={styles.signOutButton}
          disabled={deleting}
        />

        {/*
          DO NOT REMOVE CODE — account deletion temporarily disabled.
          No accounts should be deleted from the app UI at the moment.
          Restore the Delete Account button (and confirm dialogs below) to re-enable.

        <PRGButton
          title="Delete Account"
          onPress={() => setConfirmDeleteStep(1)}
          variant="danger"
          style={styles.deleteButton}
          disabled={deleting}
          accessibilityLabel="Delete account"
          accessibilityHint="Permanently deletes your account and all data"
        />
        */}

        <Text style={[styles.footerCopy, { color: colors.textTertiary }]}>
          © {new Date().getFullYear()} {APP_DISPLAY_NAME}
        </Text>
      </ScrollView>

      <PRGConfirmDialog
        visible={confirmResetVisible}
        title="Send password reset?"
        message={
          accountUsesGoogleSignIn() && !accountHasPasswordSignIn()
            ? `You usually sign in with Google. We can email ${email} a link to set an email/password for this account. (Your Google password is changed in your Google Account, not here.)`
            : `We'll email a password reset link to ${email}. Check your inbox and spam folder.`
        }
        confirmLabel={sendingReset ? 'Sending…' : 'Send link'}
        cancelLabel="Cancel"
        onCancel={() => setConfirmResetVisible(false)}
        onConfirm={() => {
          if (!sendingReset) void sendPasswordResetToAccountEmail();
        }}
      />

      {/*
        DO NOT REMOVE CODE — account deletion confirm dialogs (UI entry point removed).

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
      */}

      <PRGToast
        message="You have been successfully logged out"
        type="success"
        visible={showLogoutToast}
        onHide={() => setShowLogoutToast(false)}
        duration={4000}
      />

      {deleting ? <PRGLoadingOverlay visible message="Deleting account…" /> : null}
      {sendingReset ? <PRGLoadingOverlay visible message="Sending reset email…" /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.lg,
  },
  mobileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleInRow: {
    marginBottom: 0,
    flex: 1,
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardFlush: {
    padding: 0,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  accountText: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  themeBlock: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  themeSegment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  settingsRowText: {
    flex: 1,
    minWidth: 0,
  },
  settingsRowTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  settingsRowSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 22,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 24,
    paddingLeft: spacing.xs,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  aboutFinePrint: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
  // DO NOT REMOVE CODE — used when Delete Account button is restored
  // deleteButton: {
  //   marginTop: spacing.md,
  // },
  footerCopy: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
});
