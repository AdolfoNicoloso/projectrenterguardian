import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PRGInput,
  useToast,
} from '../../../../src/components';
import { propertyMembersService } from '../../../../src/services/propertyMembersService';
import { publicShareService } from '../../../../src/services/publicShareService';
import { getInviteWebUrl, getPublicShareWebUrl } from '../../../../src/config/webApp';
import { useProperty } from '../../../../src/hooks/usePropertiesQuery';
import { spacing, typography } from '../../../../src/theme';
import { useTheme } from '../../../../src/theme/useTheme';
import { propertyDisplayName } from '../../../../src/constants/propertyStatuses';
import { goBackOr } from '../../../../src/navigation/goBackOr';
import { Routes } from '../../../../src/navigation/routes';
import type {
  PropertyInvite,
  PropertyMember,
  PropertyMemberRole,
  PropertyPeoplePayload,
  PropertyPublicShare,
} from '../../../../src/types';

function isLinkInvite(invite: PropertyInvite): boolean {
  if (invite.invite_kind === 'link') return true;
  return !invite.invite_email && !invite.invite_phone;
}

export default function PropertyPeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { data: property } = useProperty(typeof id === 'string' ? id : undefined);

  const [people, setPeople] = useState<PropertyPeoplePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareMethod, setShareMethod] = useState<'link' | 'email' | 'public'>(
    'link'
  );
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<PropertyMemberRole>('view');
  const [inviting, setInviting] = useState(false);
  const [lastShare, setLastShare] = useState<{
    message: string;
    url: string;
  } | null>(null);

  const propertyId = typeof id === 'string' ? id : '';
  const myRole = people?.my_role || property?.my_role || 'view';
  const canInvite = myRole === 'owner' || myRole === 'edit';
  const isOwner = myRole === 'owner';

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const data = await propertyMembersService.listPeople(propertyId);
      setPeople(data);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load people', 'error');
    } finally {
      setLoading(false);
    }
  }, [propertyId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareInvite = async (message: string, url: string) => {
    setLastShare({ message, url });
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url }
          : { message: `${message}` }
      );
    } catch {
      // User cancelled
    }
  };

  const copyLastLink = async () => {
    if (!lastShare?.url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lastShare.url);
        showToast('Invite link copied', 'success');
        return;
      }
      await Share.share({ message: lastShare.url });
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  const handleInvite = async () => {
    if (!propertyId || !canInvite) return;

    if (shareMethod === 'public') {
      setInviting(true);
      try {
        const share = await publicShareService.create(propertyId);
        showToast('Public view link ready — no login required', 'success');
        await load();
        if (share.share_message && share.share_url) {
          await shareInvite(share.share_message, share.share_url);
        }
      } catch (err: any) {
        showToast(err?.message || 'Failed to create public link', 'error');
      } finally {
        setInviting(false);
      }
      return;
    }

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
        showToast('Invite created — share the link', 'success');
        setContact('');
        await load();
        if (invite.share_message && invite.share_url) {
          await shareInvite(invite.share_message, invite.share_url);
        }
      } catch (err: any) {
        showToast(err?.message || 'Failed to create invite', 'error');
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
      showToast('Share link ready', 'success');
      await load();
      if (invite.share_message && invite.share_url) {
        await shareInvite(invite.share_message, invite.share_url);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to create share link', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (member: PropertyMember, next: PropertyMemberRole) => {
    if (!isOwner) return;
    try {
      await propertyMembersService.updateMemberRole(member.id, next);
      showToast('Role updated', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update role', 'error');
    }
  };

  const handleRevokeMember = (member: PropertyMember) => {
    if (!isOwner) return;
    const confirm = () => {
      void (async () => {
        try {
          await propertyMembersService.revokeMember(member.id);
          showToast('Access removed', 'success');
          await load();
        } catch (err: any) {
          showToast(err?.message || 'Failed to remove member', 'error');
        }
      })();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm('Remove this person’s access?')) confirm();
    } else {
      Alert.alert('Remove access?', 'They will no longer see this property.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const handleRevokeInvite = async (invite: PropertyInvite) => {
    if (!isOwner) return;
    try {
      await propertyMembersService.revokeInvite(invite.id);
      showToast('Invite revoked', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to revoke invite', 'error');
    }
  };

  const handleRevokePublicShare = async (share: PropertyPublicShare) => {
    if (!canInvite) return;
    try {
      await publicShareService.revoke(share.id);
      showToast('Public link revoked', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to revoke public link', 'error');
    }
  };

  const resharePublic = async (share: PropertyPublicShare) => {
    const url = share.share_url || getPublicShareWebUrl(share.token);
    const label = property ? propertyDisplayName(property) : 'a property';
    const message = `Check out ${label} on Renter Guardian (no account needed): ${url}`;
    await shareInvite(message, url);
  };

  const reshareInvite = async (invite: PropertyInvite) => {
    const url = invite.share_url || getInviteWebUrl(invite.token);
    const label = property ? propertyDisplayName(property) : 'a property';
    const open = isLinkInvite(invite);
    const access = invite.role === 'edit' ? 'edit access' : 'view-only access';
    const message = open
      ? `Join ${label} on Renter Guardian (${access}). Sign in, then open this link: ${url}`
      : `You've been invited to ${label} on Renter Guardian. Open this link to accept: ${url}`;
    await shareInvite(message, url);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader
        title="People"
        showBack
        onBack={() =>
          goBackOr(
            router,
            typeof id === 'string' ? Routes.PROPERTIES.DETAIL(id) : Routes.RENTS.LIST
          )
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {loading && !people ? (
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Owner</Text>
            <View
              style={[
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.name, { color: colors.text }]}>
                {people?.owner?.name || 'Property owner'}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {[people?.owner?.email, people?.owner?.phone]
                  .filter(Boolean)
                  .join(' · ') || 'You'}
              </Text>
              <Text style={[styles.role, { color: colors.primary }]}>Owner</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Members
            </Text>
            {(people?.members || []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No collaborators yet.
              </Text>
            ) : (
              (people?.members || []).map((member) => (
                <View
                  key={member.id}
                  style={[
                    styles.card,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <Text style={[styles.name, { color: colors.text }]}>
                    {member.name || member.email || member.phone || 'Member'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {[member.email, member.phone].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.role, { color: colors.primary }]}>
                    {member.role === 'edit' ? 'Edit' : 'View only'}
                  </Text>
                  {isOwner ? (
                    <View style={styles.rowActions}>
                      <PRGButton
                        title={member.role === 'edit' ? 'Make view only' : 'Make edit'}
                        onPress={() =>
                          handleChangeRole(
                            member,
                            member.role === 'edit' ? 'view' : 'edit'
                          )
                        }
                        variant="secondary"
                        style={styles.smallButton}
                      />
                      <PRGButton
                        title="Remove"
                        onPress={() => handleRevokeMember(member)}
                        variant="ghost"
                        style={styles.smallButton}
                      />
                    </View>
                  ) : null}
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pending invites
            </Text>
            {(people?.invites || []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No pending invites.
              </Text>
            ) : (
              (people?.invites || []).map((invite) => {
                const open = isLinkInvite(invite);
                return (
                  <View
                    key={invite.id}
                    style={[
                      styles.card,
                      { borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                  >
                    <Text style={[styles.name, { color: colors.text }]}>
                      {open
                        ? 'Anyone with the link'
                        : invite.invite_email || invite.invite_phone}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {open
                        ? 'Join link · requires sign-in'
                        : 'Email invite · single use · requires sign-in'}
                    </Text>
                    <Text style={[styles.role, { color: colors.primary }]}>
                      {invite.role === 'edit' ? 'Edit' : 'View only'}
                    </Text>
                    <View style={styles.rowActions}>
                      <PRGButton
                        title="Share again"
                        onPress={() => reshareInvite(invite)}
                        variant="secondary"
                        style={styles.smallButton}
                      />
                      {isOwner ? (
                        <PRGButton
                          title="Revoke"
                          onPress={() => handleRevokeInvite(invite)}
                          variant="ghost"
                          style={styles.smallButton}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Public view link
            </Text>
            {people?.public_share ? (
              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.name, { color: colors.text }]}>
                  Anyone with the link
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  Preview only · no account required
                </Text>
                <Text style={[styles.role, { color: colors.primary }]}>
                  Public view
                </Text>
                <View style={styles.rowActions}>
                  <PRGButton
                    title="Share again"
                    onPress={() => resharePublic(people.public_share!)}
                    variant="secondary"
                    style={styles.smallButton}
                  />
                  {canInvite ? (
                    <PRGButton
                      title="Revoke"
                      onPress={() => handleRevokePublicShare(people.public_share!)}
                      variant="ghost"
                      style={styles.smallButton}
                    />
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No public view link yet.
              </Text>
            )}

            {canInvite ? (
              <View style={styles.inviteBlock}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Share access
                </Text>
                <Text style={[styles.help, { color: colors.textSecondary }]}>
                  Invite collaborators (sign-in required), or create a public
                  view link anyone can open without an account.
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  How to share
                </Text>
                <View style={styles.modeRow}>
                  <PRGButton
                    title="Join link"
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
                <View style={styles.modeRow}>
                  <PRGButton
                    title="Public view (no login)"
                    onPress={() => setShareMethod('public')}
                    variant={shareMethod === 'public' ? 'primary' : 'secondary'}
                    style={styles.modeButton}
                  />
                </View>

                {shareMethod !== 'public' ? (
                  <>
                    <Text
                      style={[styles.fieldLabel, { color: colors.textSecondary }]}
                    >
                      Access level
                    </Text>
                    <View style={styles.modeRow}>
                      <PRGButton
                        title="View only"
                        onPress={() => setRole('view')}
                        variant={role === 'view' ? 'primary' : 'secondary'}
                        style={styles.modeButton}
                      />
                      <PRGButton
                        title="Edit"
                        onPress={() => setRole('edit')}
                        variant={role === 'edit' ? 'primary' : 'secondary'}
                        style={styles.modeButton}
                      />
                    </View>
                  </>
                ) : null}

                {shareMethod === 'email' ? (
                  <PRGInput
                    label="Email"
                    value={contact}
                    onChangeText={setContact}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                ) : (
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    {shareMethod === 'public'
                      ? 'Creates a pasteable link. Anyone can open it to view the property, spaces, and photos — no sign-in. Creating again replaces the previous public link.'
                      : 'Creates a pasteable join link. Recipients must sign in to accept. Creating again replaces the previous join link for that access level.'}
                  </Text>
                )}

                <PRGButton
                  title={
                    shareMethod === 'public'
                      ? 'Create public link & share'
                      : shareMethod === 'link'
                        ? 'Create link & share'
                        : 'Send invite & share'
                  }
                  onPress={handleInvite}
                  loading={inviting}
                  style={styles.inviteButton}
                />
                {lastShare ? (
                  <PRGButton
                    title="Copy last invite link"
                    onPress={copyLastLink}
                    variant="ghost"
                  />
                ) : null}
              </View>
            ) : (
              <Text style={[styles.help, { color: colors.textSecondary }]}>
                You have view-only access. Ask the owner to change your role if
                you need to invite others.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
  },
  meta: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  role: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  smallButton: {
    marginTop: 0,
  },
  inviteBlock: {
    marginTop: spacing.md,
  },
  help: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeButton: { flex: 1 },
  inviteButton: { marginTop: spacing.md },
});
