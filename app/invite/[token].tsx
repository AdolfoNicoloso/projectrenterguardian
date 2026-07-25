import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PhoneAuthForm,
  ScreenContainer,
  useToast,
} from '../../src/components';
import { propertyMembersService } from '../../src/services/propertyMembersService';
import { useAuthStore } from '../../src/state/authStore';
import { usePropertiesStore } from '../../src/state/propertiesStore';
import { useNotificationsStore } from '../../src/state/notificationsStore';
import { Routes } from '../../src/navigation/routes';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

function inviteTokenFromParams(token: string | string[] | undefined): string {
  if (typeof token === 'string') return token.trim();
  if (Array.isArray(token) && typeof token[0] === 'string') return token[0].trim();
  return '';
}

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string | string[] }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const {
    isAuthenticated,
    isLoading: authLoading,
    completePhoneSignIn,
  } = useAuthStore();

  const [preview, setPreview] = useState<{
    property_label: string;
    role: string;
    invite_kind?: 'contact' | 'link';
    invite_email?: string | null;
    invite_phone?: string | null;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [showPhone, setShowPhone] = useState(false);

  const inviteToken = inviteTokenFromParams(token);

  useEffect(() => {
    if (!inviteToken || authLoading) return;
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const data = await propertyMembersService.getInvitePreview(inviteToken);
        if (!cancelled) setPreview(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Invite not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, isAuthenticated, authLoading]);

  const accept = async () => {
    if (!inviteToken || accepting) return;
    setAccepting(true);
    setError('');
    try {
      await propertyMembersService.acceptInvite(inviteToken);
      showToast('Invitation accepted', 'success');
      await usePropertiesStore.getState().fetchList({ force: true });
      void useNotificationsStore.getState().fetch({ force: true });
      // Stay in hub — invitations are tracked in the notifications inbox.
      router.replace(Routes.RENTS.LIST);
    } catch (err: any) {
      setError(err?.message || 'Could not accept invite');
      showToast(err?.message || 'Could not accept invite', 'error');
    } finally {
      setAccepting(false);
    }
  };

  const inviteNotPending =
    !!preview && (preview.status || '').toLowerCase() !== 'pending';

  if (authLoading) {
    return (
      <ScreenContainer>
        <PRGHeader title="Invitation" showBack={false} />
        <Text style={{ color: colors.textSecondary, padding: spacing.md }}>
          Loading…
        </Text>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    const openLinkHint =
      'Sign in (or create an account), then open this link again to join the property.';
    return (
      <ScreenContainer>
        <PRGHeader title="Invitation" showBack={false} />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            You’ve been invited
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {openLinkHint}
          </Text>
          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}
          <PRGButton
            title="Sign in with email"
            onPress={() => router.push('/(auth)/login')}
            style={styles.button}
          />
          <PRGButton
            title="Sign in with phone"
            onPress={() => setShowPhone((v) => !v)}
            variant="secondary"
            style={styles.button}
          />
          {showPhone ? (
            <PhoneAuthForm
              onError={setError}
              onSuccess={async () => {
                await completePhoneSignIn();
                setShowPhone(false);
              }}
            />
          ) : null}
          <PRGButton
            title="Create account"
            onPress={() => router.push('/(auth)/signup')}
            variant="ghost"
            style={styles.button}
          />
        </View>
      </ScreenContainer>
    );
  }

  const isOpenLink =
    preview?.invite_kind === 'link' ||
    (!!preview && !preview.invite_email && !preview.invite_phone);

  return (
    <ScreenContainer>
      <PRGHeader title="Invitation" showBack={false} />
      <View style={styles.content}>
        {loading ? (
          <Text style={{ color: colors.textSecondary }}>Loading invite…</Text>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Join {preview?.property_label || 'this property'}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              You’ll get{' '}
              {preview?.role === 'edit' ? 'edit' : 'view-only'} access.
              {isOpenLink
                ? ' Anyone signed in with this link can join.'
                : ''}
              {!isOpenLink && preview?.invite_email
                ? ` Sign-in email should match ${preview.invite_email}.`
                : ''}
              {!isOpenLink && preview?.invite_phone
                ? ` Sign-in phone should match ${preview.invite_phone}.`
                : ''}
            </Text>
            {error ? (
              <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : null}
            {inviteNotPending ? (
              <Text style={[styles.error, { color: colors.textSecondary }]}>
                This invite is no longer pending
                {preview?.status ? ` (${preview.status})` : ''}.
              </Text>
            ) : null}
            <PRGButton
              title="Accept invitation"
              onPress={accept}
              loading={accepting}
              disabled={!inviteToken || inviteNotPending}
              style={styles.button}
              accessibilityLabel="Accept invitation"
            />
            <PRGButton
              title="Not now"
              onPress={() => router.replace(Routes.RENTS.LIST)}
              variant="ghost"
              style={styles.button}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  error: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
});
