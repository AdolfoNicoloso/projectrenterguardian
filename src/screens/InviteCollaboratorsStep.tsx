/**
 * Post-create wizard step: ask if they’re looking/sharing with someone,
 * then optionally send property invites. Property already exists.
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
  const [contactMode, setContactMode] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<PropertyMemberRole>('edit');
  const [inviting, setInviting] = useState(false);
  const [invitesSent, setInvitesSent] = useState(0);

  const prompt = isTouring
    ? 'Looking with someone?'
    : 'Sharing this place with someone?';
  const helper = isTouring
    ? 'Invite a roommate, partner, or co-tourer so they can follow along. You can always invite people later.'
    : 'Invite a roommate or partner to view or edit this property. You can always invite people later.';

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
    const trimmed = contact.trim();
    if (!trimmed) {
      showToast(
        contactMode === 'email' ? 'Enter an email' : 'Enter a phone number',
        'error'
      );
      return;
    }
    setInviting(true);
    try {
      const invite = await propertyMembersService.createInvite({
        propertyId,
        role,
        ...(contactMode === 'email' ? { email: trimmed } : { phone: trimmed }),
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
                  title="Yes, invite someone"
                  onPress={() => setPhase('invite')}
                  style={styles.button}
                  accessibilityLabel="Yes, invite someone"
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
                <View style={styles.modeRow}>
                  <PRGButton
                    title="Email"
                    onPress={() => setContactMode('email')}
                    variant={contactMode === 'email' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                  <PRGButton
                    title="Phone"
                    onPress={() => setContactMode('phone')}
                    variant={contactMode === 'phone' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                </View>

                <PRGInput
                  label={contactMode === 'email' ? 'Email' : 'Phone'}
                  value={contact}
                  onChangeText={setContact}
                  placeholder={
                    contactMode === 'email'
                      ? 'name@example.com'
                      : '+1 555 555 5555'
                  }
                  keyboardType={
                    contactMode === 'email' ? 'email-address' : 'phone-pad'
                  }
                  autoCapitalize="none"
                  style={styles.input}
                />

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

                <PRGButton
                  title={invitesSent > 0 ? 'Send another invite' : 'Send invite'}
                  onPress={() => void handleInvite()}
                  loading={inviting}
                  style={styles.button}
                  accessibilityLabel="Send invite"
                />

                {invitesSent > 0 ? (
                  <Text
                    style={[styles.sentNote, { color: colors.textSecondary }]}
                  >
                    {invitesSent === 1
                      ? '1 invite sent. You can invite more or continue.'
                      : `${invitesSent} invites sent. You can invite more or continue.`}
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
