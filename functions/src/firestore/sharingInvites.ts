/**
 * Property invite create / accept / notify / revoke / preview.
 */

import {db, nowIso, snapToDoc, type FsDoc} from "./db";
import {requirePropertyAccess} from "./access";
import {
  createNotification,
  hasInviteNotification,
  markInviteNotificationsRead,
} from "./notifications";
import {
  type CollaboratorRole,
  normalizeInviteEmail,
  normalizeInvitePhone,
} from "./sharingNormalize";
import {
  INVITE_TTL_MS,
  isOpenLinkInvite,
  loadProfileRaw,
  mapInviteToClient,
  newInviteToken,
  propertyLabel,
  shareMessage,
  shareUrlForToken,
} from "./sharingInternal";

/**
 * Creates a pending invite. Owner or edit may invite.
 * Modes:
 * - contact (default): bound to one email or phone; single acceptor.
 * - link: anyone signed in with the link may join
 *   (multi-join until expiry/revoke).
 * @param {string} appProfileId Caller.
 * @param {object} input Invite input.
 * @return {Promise<Record<string, unknown>>} Invite + share payload.
 */
export async function createPropertyInvite(
  appProfileId: string,
  input: {
    propertyId: string;
    role: string;
    email?: string | null;
    phone?: string | null;
    mode?: "contact" | "link" | string | null;
  }
): Promise<Record<string, unknown>> {
  const access = await requirePropertyAccess(
    appProfileId,
    input.propertyId,
    "edit"
  );
  const role = String(input.role || "").toLowerCase();
  if (role !== "edit" && role !== "view") {
    throw new Error("BAD_INVITE_ROLE");
  }

  const modeRaw = String(input.mode || "contact").toLowerCase();
  const isLinkMode = modeRaw === "link" || modeRaw === "open";

  if (isLinkMode) {
    // One live open link per property + role: rotate token when recreating.
    const pendingSnap = await db()
      .collection("property_invites")
      .where("property_id", "==", input.propertyId)
      .where("status", "==", "pending")
      .limit(100)
      .get();
    const tsRotate = nowIso();
    for (const d of pendingSnap.docs) {
      const existing = snapToDoc(d);
      if (!existing || !isOpenLinkInvite(existing)) continue;
      if (String(existing.role || "") !== role) continue;
      await db().collection("property_invites").doc(existing.id).update({
        status: "revoked",
        date_updated: tsRotate,
      });
    }

    const ts = nowIso();
    const token = newInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const ref = db().collection("property_invites").doc();
    await ref.set({
      property_id: input.propertyId,
      role,
      status: "pending",
      invite_kind: "link",
      invite_email: null,
      invite_phone: null,
      token,
      invited_by_app_profile_id: appProfileId,
      expires_at: expiresAt,
      date_created: ts,
      date_updated: ts,
    });
    const doc = snapToDoc(await ref.get());
    if (!doc) {
      throw new Error("Firestore: create invite failed");
    }
    const label = propertyLabel(access.property);
    const mapped = mapInviteToClient(doc);
    return {
      ...mapped,
      share_url: shareUrlForToken(token),
      share_message: shareMessage(label, token, {openLink: true, role}),
    };
  }

  const email = input.email ? normalizeInviteEmail(input.email) : null;
  const phone = input.phone ? normalizeInvitePhone(input.phone) : null;
  if ((!email && !phone) || (email && phone)) {
    throw new Error("INVITE_CONTACT_REQUIRED");
  }

  // Reject inviting the owner by matching email/phone on owner profile.
  const ownerId = String(access.property.app_profile_id || "");
  if (ownerId) {
    const owner = await loadProfileRaw(ownerId);
    if (email && owner?.email && String(owner.email).toLowerCase() === email) {
      throw new Error("CANNOT_INVITE_OWNER");
    }
    if (
      phone &&
      owner?.phone &&
      normalizeInvitePhone(String(owner.phone)) === phone
    ) {
      throw new Error("CANNOT_INVITE_OWNER");
    }
  }

  // Reject duplicate active member / pending invite.
  if (email) {
    const existingMembers = await db()
      .collection("app_profiles")
      .where("email", "==", email)
      .limit(5)
      .get();
    for (const p of existingMembers.docs) {
      const mem = await db()
        .collection("property_members")
        .where("property_id", "==", input.propertyId)
        .where("app_profile_id", "==", p.id)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!mem.empty) {
        throw new Error("ALREADY_MEMBER");
      }
    }
    const pending = await db()
      .collection("property_invites")
      .where("property_id", "==", input.propertyId)
      .where("invite_email", "==", email)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) {
      throw new Error("INVITE_ALREADY_PENDING");
    }
  }
  if (phone) {
    const existingProfiles = await db()
      .collection("app_profiles")
      .where("phone", "==", phone)
      .limit(5)
      .get();
    for (const p of existingProfiles.docs) {
      const mem = await db()
        .collection("property_members")
        .where("property_id", "==", input.propertyId)
        .where("app_profile_id", "==", p.id)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!mem.empty) {
        throw new Error("ALREADY_MEMBER");
      }
    }
    const pending = await db()
      .collection("property_invites")
      .where("property_id", "==", input.propertyId)
      .where("invite_phone", "==", phone)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) {
      throw new Error("INVITE_ALREADY_PENDING");
    }
  }

  const ts = nowIso();
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const ref = db().collection("property_invites").doc();
  await ref.set({
    property_id: input.propertyId,
    role,
    status: "pending",
    invite_kind: "contact",
    invite_email: email,
    invite_phone: phone,
    token,
    invited_by_app_profile_id: appProfileId,
    expires_at: expiresAt,
    date_created: ts,
    date_updated: ts,
  });
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create invite failed");
  }
  const label = propertyLabel(access.property);
  const mapped = mapInviteToClient(doc);

  // Notify existing users matching the invite contact (in-app inbox + banner).
  try {
    await notifyInviteesForInvite({
      inviteId: ref.id,
      token,
      propertyId: input.propertyId,
      propertyLabel: label,
      role,
      email,
      phone,
    });
  } catch (err) {
    console.warn("[createPropertyInvite] notify invitees failed", err);
  }

  return {
    ...mapped,
    share_url: shareUrlForToken(token),
    share_message: shareMessage(label, token),
  };
}

/**
 * Accepts a pending invite document for a profile.
 * @param {FsDoc} invite Invite document.
 * @param {string} appProfileId Accepting profile id.
 * @return {Promise<Object>} Accept result payload.
 */
async function acceptInviteDoc(
  invite: FsDoc,
  appProfileId: string
): Promise<Record<string, unknown>> {
  const propertyId = String(invite.property_id || "");
  const role = String(invite.role || "view") as CollaboratorRole;
  const roleOut = role === "edit" ? "edit" : "view";
  const openLink = isOpenLinkInvite(invite);

  // Already an active member — success even if invite was auto-claimed earlier.
  const existing = await db()
    .collection("property_members")
    .where("property_id", "==", propertyId)
    .where("app_profile_id", "==", appProfileId)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (!existing.empty) {
    // Contact invites are single-use; open links stay pending for others.
    if (invite.status === "pending" && !openLink) {
      await db().collection("property_invites").doc(invite.id).update({
        status: "accepted",
        accepted_by_app_profile_id: appProfileId,
        date_updated: nowIso(),
      });
    }
    try {
      await markInviteNotificationsRead(appProfileId, invite.id);
    } catch (err) {
      console.warn("[acceptInviteDoc] mark invite notifications failed", err);
    }
    return {
      already_member: true,
      property_id: propertyId,
      role: roleOut,
      member_id: existing.docs[0].id,
    };
  }

  if (invite.status !== "pending") {
    if (
      invite.status === "accepted" &&
      String(invite.accepted_by_app_profile_id || "") === appProfileId
    ) {
      try {
        await markInviteNotificationsRead(appProfileId, invite.id);
      } catch (err) {
        console.warn("[acceptInviteDoc] mark invite notifications failed", err);
      }
      return {already_member: true, property_id: propertyId, role: roleOut};
    }
    throw new Error("INVITE_NOT_PENDING");
  }
  if (
    invite.expires_at &&
    Date.parse(String(invite.expires_at)) <= Date.now()
  ) {
    await db().collection("property_invites").doc(invite.id).update({
      status: "expired",
      date_updated: nowIso(),
    });
    throw new Error("INVITE_EXPIRED");
  }

  // Cannot accept as owner
  const prop = snapToDoc(
    await db().collection("properties").doc(propertyId).get()
  );
  if (prop && prop.app_profile_id === appProfileId) {
    // Don't revoke an open group-chat link just because the owner opened it.
    if (!openLink) {
      await db().collection("property_invites").doc(invite.id).update({
        status: "accepted",
        date_updated: nowIso(),
      });
    }
    throw new Error("CANNOT_INVITE_OWNER");
  }

  const ts = nowIso();
  const memberRef = db().collection("property_members").doc();
  await memberRef.set({
    property_id: propertyId,
    app_profile_id: appProfileId,
    role: roleOut,
    status: "active",
    invited_by_app_profile_id: invite.invited_by_app_profile_id ?? null,
    invite_id: invite.id,
    date_created: ts,
    date_updated: ts,
  });

  if (openLink) {
    // Multi-join: leave invite pending so others with the link can still join.
    await db().collection("property_invites").doc(invite.id).update({
      date_updated: ts,
      last_accepted_by_app_profile_id: appProfileId,
    });
  } else {
    await db().collection("property_invites").doc(invite.id).update({
      status: "accepted",
      accepted_by_app_profile_id: appProfileId,
      date_updated: ts,
    });
  }

  try {
    await markInviteNotificationsRead(appProfileId, invite.id);
  } catch (err) {
    console.warn("[acceptInviteDoc] mark invite notifications failed", err);
  }

  return {
    property_id: propertyId,
    role: roleOut,
    member_id: memberRef.id,
  };
}

/**
 * Accept invite by token. Validates email/phone match when present.
 * @param {string} appProfileId Caller.
 * @param {string} token Invite token.
 * @param {Object} identity Auth identity.
 * @param {string|null=} identity.email Email from Auth.
 * @param {string|null=} identity.phone Phone from Auth.
 * @return {Promise<Object>} Accept result.
 */
export async function acceptPropertyInvite(
  appProfileId: string,
  token: string,
  identity: {email?: string | null; phone?: string | null}
): Promise<Record<string, unknown>> {
  const snap = await db()
    .collection("property_invites")
    .where("token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new Error("NOT_FOUND");
  }
  const invite = snapToDoc(snap.docs[0]);
  if (!invite) {
    throw new Error("NOT_FOUND");
  }

  const inviteEmail = invite.invite_email ?
    String(invite.invite_email).toLowerCase() : null;
  const invitePhone = invite.invite_phone ?
    normalizeInvitePhone(String(invite.invite_phone)) : null;

  if (inviteEmail) {
    const email = identity.email ?
      normalizeInviteEmail(identity.email) : null;
    if (!email || email !== inviteEmail) {
      throw new Error("INVITE_IDENTITY_MISMATCH");
    }
  }
  if (invitePhone) {
    const phone = identity.phone ?
      normalizeInvitePhone(identity.phone) : null;
    if (!phone || phone !== invitePhone) {
      throw new Error("INVITE_IDENTITY_MISMATCH");
    }
  }

  return acceptInviteDoc(invite, appProfileId);
}

/**
 * Create in-app notifications for profiles matching invite email/phone.
 * Does not auto-accept — invitee must accept from inbox or invite link.
 * @param {object} input Invite notification context.
 * @return {Promise<number>} Notifications written.
 */
async function notifyInviteesForInvite(input: {
  inviteId: string;
  token: string;
  propertyId: string;
  propertyLabel: string;
  role: string;
  email: string | null;
  phone: string | null;
}): Promise<number> {
  const profileIds = new Set<string>();
  if (input.email) {
    const snap = await db()
      .collection("app_profiles")
      .where("email", "==", input.email)
      .limit(5)
      .get();
    for (const d of snap.docs) {
      profileIds.add(d.id);
    }
  }
  if (input.phone) {
    const snap = await db()
      .collection("app_profiles")
      .where("phone", "==", input.phone)
      .limit(5)
      .get();
    for (const d of snap.docs) {
      profileIds.add(d.id);
    }
  }

  const roleLabel = input.role === "edit" ? "edit" : "view-only";
  const title = "Property invitation";
  const body =
    `You've been invited to ${input.propertyLabel} ` +
    `with ${roleLabel} access.`;

  let written = 0;
  for (const appProfileId of profileIds) {
    if (await hasInviteNotification(appProfileId, input.inviteId)) {
      continue;
    }
    await createNotification({
      appProfileId,
      propertyId: input.propertyId,
      type: "property_invite",
      title,
      body,
      inviteId: input.inviteId,
      inviteToken: input.token,
    });
    written += 1;
  }
  return written;
}

/**
 * Discover pending invites for a profile and ensure inbox notifications exist.
 * Does NOT auto-accept (replaces silent claim-on-login).
 * @param {string} appProfileId Profile id.
 * @param {Object} identity Contact info.
 * @param {string|null=} identity.email Email.
 * @param {string|null=} identity.phone Phone.
 * @return {Promise<number>} Notifications created.
 */
export async function notifyPendingInvitesForProfile(
  appProfileId: string,
  identity: {email?: string | null; phone?: string | null}
): Promise<number> {
  let created = 0;
  const email = identity.email ?
    normalizeInviteEmail(identity.email) : null;
  const phone = identity.phone ?
    normalizeInvitePhone(identity.phone) : null;

  const scan = async (
    field: "invite_email" | "invite_phone",
    value: string
  ) => {
    const snap = await db()
      .collection("property_invites")
      .where(field, "==", value)
      .where("status", "==", "pending")
      .limit(50)
      .get();
    for (const d of snap.docs) {
      const invite = snapToDoc(d);
      if (!invite) continue;
      if (
        invite.expires_at &&
        Date.parse(String(invite.expires_at)) <= Date.now()
      ) {
        continue;
      }
      if (await hasInviteNotification(appProfileId, invite.id)) {
        continue;
      }
      const prop = snapToDoc(
        await db()
          .collection("properties")
          .doc(String(invite.property_id))
          .get()
      );
      const label = prop ? propertyLabel(prop) : "a property";
      const role = String(invite.role || "view");
      const roleLabel = role === "edit" ? "edit" : "view-only";
      await createNotification({
        appProfileId,
        propertyId: String(invite.property_id || ""),
        type: "property_invite",
        title: "Property invitation",
        body:
          `You've been invited to ${label} with ${roleLabel} access.`,
        inviteId: invite.id,
        inviteToken: String(invite.token || ""),
      });
      created += 1;
    }
  };

  if (email) {
    await scan("invite_email", email);
  }
  if (phone) {
    await scan("invite_phone", phone);
  }
  return created;
}

/**
 * @deprecated No longer auto-accepts. Delegates to notify-only path so any
 * leftover callers cannot silently assign membership.
 * @param {string} appProfileId Profile id.
 * @param {Object} identity Contact info.
 * @param {string|null=} identity.email Email.
 * @param {string|null=} identity.phone Phone.
 * @return {Promise<number>} Notifications created (not memberships).
 */
export async function claimPendingInvitesForProfile(
  appProfileId: string,
  identity: {email?: string | null; phone?: string | null}
): Promise<number> {
  return notifyPendingInvitesForProfile(appProfileId, identity);
}

/**
 * Owner-only: revoke a pending invite.
 * @param {string} appProfileId Caller.
 * @param {string} inviteId Invite id.
 * @return {Promise<boolean>} True when revoked.
 */
export async function revokePropertyInvite(
  appProfileId: string,
  inviteId: string
): Promise<boolean> {
  const invite = snapToDoc(
    await db().collection("property_invites").doc(inviteId).get()
  );
  if (!invite) {
    return false;
  }
  await requirePropertyAccess(
    appProfileId,
    String(invite.property_id),
    "owner"
  );
  await db().collection("property_invites").doc(inviteId).update({
    status: "revoked",
    date_updated: nowIso(),
  });
  return true;
}

/**
 * Preview invite by token (for accept screen before/after auth).
 * @param {string} token Invite token.
 * @return {Promise<Record<string, unknown>|null>} Safe preview.
 */
export async function getInvitePreviewByToken(
  token: string
): Promise<Record<string, unknown> | null> {
  const snap = await db()
    .collection("property_invites")
    .where("token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const invite = snapToDoc(snap.docs[0]);
  if (!invite) {
    return null;
  }
  const prop = snapToDoc(
    await db().collection("properties").doc(String(invite.property_id)).get()
  );
  return {
    token: invite.token,
    role: invite.role,
    status: invite.status,
    invite_kind: isOpenLinkInvite(invite) ? "link" : "contact",
    invite_email: invite.invite_email ?? null,
    invite_phone: invite.invite_phone ?? null,
    expires_at: invite.expires_at ?? null,
    property_label: prop ? propertyLabel(prop) : "a property",
  };
}
