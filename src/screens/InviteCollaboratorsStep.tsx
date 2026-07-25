/**
 * Post-create wizard step: ask if they’re looking/sharing with someone,
 * then optionally share a link or invite by email. Property already exists.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import {
  PRGButton,
  PRGHeader,
  PRGInput,
  ScrollableScreenContainer,
  useToast,
} from '../components';
import { propertyMembersService } from '../services/propertyMembersService';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { PropertyMemberRole } from '../types';

export type InviteCollaboratorsStepProps = {
  propertyId: string;
  isTouring: boolean;
  onContinue: () => void;
  /** When true, show a mid-app style header (no back — property already created). */
  showHeader?: boolean;
};

export function InviteCollaboratorsStep({
  propertyId,
  isTouring,
  onContinue,
  showHeader = false,
}: InviteCollaboratorsStepProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<'ask' | 'invite'>('ask');
  const [shareMethod, setShareMethod] = useState<'link' | 'email'>('link');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<PropertyMemberRole>('edit');
  const [inviting, setInviting] = useState(false);
  const [invitesSent, setInvitesSent] = useState(0);

  const prompt = isTouring
    ? 'Looking with someone?'
    : 'Sharing this place with someone?';
  const helper = isTouring
    ? 'Share a link in your group chat, or invite people by email. They’ll need to sign in to join.'
    : 'Share a link, or invite a roommate/partner by email. They’ll need to sign in to join.';

  const shareInvite = async (message: string, url: string) => {
    try {
      await Share.share(
        Platform.OS === 'ios' ? { message, url } : { message: `${message}` }
      );
    } catch {
      // User cancelled share sheet
    }
  };

  const handleInvite = async () => {
    if (!propertyId) return;

    if (shareMethod === 'email') {
      const trimmed = contact.trim();
      if (!trimmed) {
        showToast('Enter an email', 'error');
        return;
      }
      setInviting(true);
      try {
        const invite = await propertyMembersService.createInvite({
          propertyId,
          role,
          mode: 'contact',
          email: trimmed,
        });
        setContact('');
        setInvitesSent((n) => n + 1);
        showToast('Invite created — share the link', 'success');
        if (invite.share_message && invite.share_url) {
          await shareInvite(invite.share_message, invite.share_url);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create invite';
        showToast(message, 'error');
      } finally {
        setInviting(false);
      }
      return;
    }

    setInviting(true);
    try {
      const invite = await propertyMembersService.createInvite({
        propertyId,
        role,
        mode: 'link',
      });
      setInvitesSent((n) => n + 1);
      showToast('Share link ready', 'success');
      if (invite.share_message && invite.share_url) {
        await shareInvite(invite.share_message, invite.share_url);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create share link';
      showToast(message, 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showHeader ? (
        <PRGHeader title="Invite" showBack={false} />
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollableScreenContainer
          includeTopSafeArea={!showHeader}
          includeBottomSafeArea
          horizontalPadding={spacing.lg}
          topPadding={showHeader ? spacing.lg : spacing.xl}
          bottomPadding={spacing.xl}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={Platform.OS === 'web'}
        >
          <View style={styles.content}>
            <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              {helper}
            </Text>

            {phase === 'ask' ? (
              <View style={styles.choiceBlock}>
                <PRGButton
                  title="Yes, share access"
                  onPress={() => setPhase('invite')}
                  style={styles.button}
                  accessibilityLabel="Yes, share access"
                />
                <PRGButton
                  title="Just me"
                  onPress={onContinue}
                  variant="secondary"
                  style={styles.button}
                  accessibilityLabel="Just me, skip inviting"
                />
              </View>
            ) : (
              <View style={styles.inviteBlock}>
                <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>
                  How to share
                </Text>
                <View style={styles.modeRow}>
                  <PRGButton
                    title="Anyone with link"
                    onPress={() => setShareMethod('link')}
                    variant={shareMethod === 'link' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                  <PRGButton
                    title="By email"
                    onPress={() => setShareMethod('email')}
                    variant={shareMethod === 'email' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                </View>

                <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>
                  Access
                </Text>
                <View style={styles.modeRow}>
                  <PRGButton
                    title="Can edit"
                    onPress={() => setRole('edit')}
                    variant={role === 'edit' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                  <PRGButton
                    title="View only"
                    onPress={() => setRole('view')}
                    variant={role === 'view' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                </View>

                {shareMethod === 'email' ? (
                  <PRGInput
                    label="Email"
                    value={contact}
                    onChangeText={setContact}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                ) : null}

                <PRGButton
                  title={
                    shareMethod === 'link'
                      ? invitesSent > 0
                        ? 'Create another link'
                        : 'Create link & share'
                      : invitesSent > 0
                        ? 'Send another invite'
                        : 'Send invite'
                  }
                  onPress={() => void handleInvite()}
                  loading={inviting}
                  style={styles.button}
                  accessibilityLabel={
                    shareMethod === 'link' ? 'Create share link' : 'Send invite'
                  }
                />

                {invitesSent > 0 ? (
                  <Text
                    style={[styles.sentNote, { color: colors.textSecondary }]}
                  >
                    {invitesSent === 1
                      ? '1 invite ready. You can share more or continue.'
                      : `${invitesSent} invites ready. You can share more or continue.`}
                  </Text>
                ) : null}

                <PRGButton
                  title={invitesSent > 0 ? 'Continue' : 'Skip for now'}
                  onPress={onContinue}
                  variant={invitesSent > 0 ? 'primary' : 'ghost'}
                  style={styles.button}
                  accessibilityLabel={
                    invitesSent > 0 ? 'Continue' : 'Skip inviting for now'
                  }
                />
              </View>
            )}
          </View>
        </ScrollableScreenContainer>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
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
    marginBottom: spacing.sm,
  },
  helper: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  choiceBlock: {
    gap: spacing.sm,
  },
  inviteBlock: {
    gap: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modeButton: {
    flex: 1,
  },
  input: {
    marginBottom: spacing.xs,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  button: {
    marginTop: spacing.sm,
  },
  sentNote: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
