/**
 * Property members and invites (sharing).
 */

import * as crypto from "crypto";
import {db, nowIso, snapToDoc, type FsDoc} from "./db";
import {
  requirePropertyAccess,
  type PropertyRole,
} from "./access";
import {mapPropertyToClient} from "./mappers";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SHARE_SCHEME = "renterguardian";
const DEFAULT_WEB_APP_URL = "https://project-renter-guardian.web.app";

/**
 * Public HTTPS origin for invite links (Firebase Hosting).
 * Override with WEB_APP_URL in functions/.env.
 * @return {string} Origin without trailing slash.
 */
function webAppBaseUrl(): string {
  const fromEnv =
    process.env.WEB_APP_URL ||
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    "";
  const trimmed = fromEnv.trim().replace(/\/$/, "");
  return trimmed || DEFAULT_WEB_APP_URL;
}

/**
 * @param {string} token Invite token.
 * @return {string} HTTPS invite URL for web (and app deep link fallback).
 */
function shareUrlForToken(token: string): string {
  return `${webAppBaseUrl()}/invite/${encodeURIComponent(token)}`;
}

/**
 * Optional native deep link for users who already have the app.
 * @param {string} token Invite token.
 * @return {string} Custom-scheme URL.
 */
function appDeepLinkForToken(token: string): string {
  return `${SHARE_SCHEME}://invite/${token}`;
}

export type CollaboratorRole = "edit" | "view";

/**
 * @param {string} email Raw email.
 * @return {string|null} Normalized email or null.
 */
export function normalizeInviteEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@") || trimmed.length > 320) {
    return null;
  }
  return trimmed;
}

/**
 * Normalize phone to E.164-ish (+digits). US 10-digit → +1…
 * @param {string} phone Raw phone.
 * @return {string|null} Normalized phone or null.
 */
export function normalizeInvitePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * @return {string} Random invite token.
 */
function newInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * @param {string} propertyLabel Property display name.
 * @param {string} token Invite token.
 * @return {string} Prefill share message.
 */
function shareMessage(
  propertyLabel: string,
  token: string
): string {
  const webUrl = shareUrlForToken(token);
  return (
    `You've been invited to ${propertyLabel} on Renter Guardian. ` +
    `Open this link to accept: ${webUrl}`
  );
}

/**
 * @param {FsDoc} doc Property document.
 * @return {string} Display label.
 */
function propertyLabel(doc: FsDoc): string {
  const nick = typeof doc.nickname === "string" ? doc.nickname.trim() : "";
  if (nick) {
    return nick;
  }
  return String(doc.address_free_text || "a property");
}

/**
 * @param {FsDoc} doc Invite doc.
 * @return {Record<string, unknown>} Client invite.
 */
function mapInviteToClient(doc: FsDoc): Record<string, unknown> {
  return {
    id: doc.id,
    property_id: doc.property_id,
    role: doc.role,
    status: doc.status,
    invite_email: doc.invite_email ?? null,
    invite_phone: doc.invite_phone ?? null,
    token: doc.token,
    invited_by_app_profile_id: doc.invited_by_app_profile_id,
    expires_at: doc.expires_at ?? null,
    date_created: doc.date_created,
    date_updated: doc.date_updated,
    share_url: typeof doc.token === "string" ?
      shareUrlForToken(doc.token) : null,
    app_deep_link: typeof doc.token === "string" ?
      appDeepLinkForToken(doc.token) : null,
  };
}

/**
 * @param {FsDoc} doc Member doc.
 * @param {Record<string, unknown>|null} profile Optional profile.
 * @return {Record<string, unknown>} Client member.
 */
function mapMemberToClient(
  doc: FsDoc,
  profile: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    id: doc.id,
    property_id: doc.property_id,
    app_profile_id: doc.app_profile_id,
    role: doc.role,
    status: doc.status,
    invited_by_app_profile_id: doc.invited_by_app_profile_id,
    date_created: doc.date_created,
    date_updated: doc.date_updated,
    name: profile?.name ?? null,
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
  };
}

/**
 * @param {string} appProfileId Profile id.
 * @return {Promise<Object|null>} Raw profile fields or null.
 */
async function loadProfileRaw(
  appProfileId: string
): Promise<Record<string, unknown> | null> {
  const doc = snapToDoc(
    await db().collection("app_profiles").doc(appProfileId).get()
  );
  return doc;
}

/**
 * Creates a pending invite. Owner or edit may invite.
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
  return {
    ...mapped,
    share_url: shareUrlForToken(token),
    share_message: shareMessage(label, token),
  };
}

/**
 * Lists owner, active members, and pending invites for a property.
 * @param {string} appProfileId Caller.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>>} Members payload.
 */
export async function listPropertyPeople(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown>> {
  const access = await requirePropertyAccess(appProfileId, propertyId, "view");
  const ownerId = String(access.property.app_profile_id || "");
  const ownerProfile = ownerId ? await loadProfileRaw(ownerId) : null;

  const membersSnap = await db()
    .collection("property_members")
    .where("property_id", "==", propertyId)
    .where("status", "==", "active")
    .limit(100)
    .get();
  const members = [];
  for (const d of membersSnap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    const profile = await loadProfileRaw(String(doc.app_profile_id || ""));
    members.push(mapMemberToClient(doc, profile));
  }

  const invitesSnap = await db()
    .collection("property_invites")
    .where("property_id", "==", propertyId)
    .where("status", "==", "pending")
    .limit(100)
    .get();
  const invites = invitesSnap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .filter((d) => {
      if (!d.expires_at) return true;
      return Date.parse(String(d.expires_at)) > Date.now();
    })
    .map((d) => mapInviteToClient(d));

  return {
    my_role: access.role,
    owner: {
      app_profile_id: ownerId,
      role: "owner",
      name: ownerProfile?.name ?? null,
      email: ownerProfile?.email ?? null,
      phone: ownerProfile?.phone ?? null,
    },
    members,
    invites,
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
  if (invite.status !== "pending") {
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

  const propertyId = String(invite.property_id || "");
  const role = String(invite.role || "view") as CollaboratorRole;

  // Already a member?
  const existing = await db()
    .collection("property_members")
    .where("property_id", "==", propertyId)
    .where("app_profile_id", "==", appProfileId)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (!existing.empty) {
    await db().collection("property_invites").doc(invite.id).update({
      status: "accepted",
      date_updated: nowIso(),
    });
    return {already_member: true, property_id: propertyId, role};
  }

  // Cannot accept as owner
  const prop = snapToDoc(
    await db().collection("properties").doc(propertyId).get()
  );
  if (prop && prop.app_profile_id === appProfileId) {
    await db().collection("property_invites").doc(invite.id).update({
      status: "accepted",
      date_updated: nowIso(),
    });
    throw new Error("CANNOT_INVITE_OWNER");
  }

  const ts = nowIso();
  const memberRef = db().collection("property_members").doc();
  await memberRef.set({
    property_id: propertyId,
    app_profile_id: appProfileId,
    role: role === "edit" ? "edit" : "view",
    status: "active",
    invited_by_app_profile_id: invite.invited_by_app_profile_id ?? null,
    invite_id: invite.id,
    date_created: ts,
    date_updated: ts,
  });
  await db().collection("property_invites").doc(invite.id).update({
    status: "accepted",
    accepted_by_app_profile_id: appProfileId,
    date_updated: ts,
  });

  return {
    property_id: propertyId,
    role: role === "edit" ? "edit" : "view",
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
 * Claim all pending invites matching the user's email and/or phone.
 * @param {string} appProfileId Profile id.
 * @param {Object} identity Contact info.
 * @param {string|null=} identity.email Email.
 * @param {string|null=} identity.phone Phone.
 * @return {Promise<number>} Number of invites claimed.
 */
export async function claimPendingInvitesForProfile(
  appProfileId: string,
  identity: {email?: string | null; phone?: string | null}
): Promise<number> {
  let claimed = 0;
  const email = identity.email ?
    normalizeInviteEmail(identity.email) : null;
  const phone = identity.phone ?
    normalizeInvitePhone(identity.phone) : null;

  const claimSnap = async (
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
      try {
        await acceptInviteDoc(invite, appProfileId);
        claimed += 1;
      } catch {
        // Skip expired / already member / owner conflicts.
      }
    }
  };

  if (email) {
    await claimSnap("invite_email", email);
  }
  if (phone) {
    await claimSnap("invite_phone", phone);
  }
  return claimed;
}

/**
 * Owner-only: change an active member's role.
 * @param {string} appProfileId Caller.
 * @param {string} memberId Member doc id.
 * @param {string} role edit|view.
 * @return {Promise<Record<string, unknown>>} Updated member.
 */
export async function updatePropertyMemberRole(
  appProfileId: string,
  memberId: string,
  role: string
): Promise<Record<string, unknown>> {
  const next = String(role || "").toLowerCase();
  if (next !== "edit" && next !== "view") {
    throw new Error("BAD_INVITE_ROLE");
  }
  const member = snapToDoc(
    await db().collection("property_members").doc(memberId).get()
  );
  if (!member || member.status !== "active") {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(
    appProfileId,
    String(member.property_id),
    "owner"
  );
  await db().collection("property_members").doc(memberId).update({
    role: next,
    date_updated: nowIso(),
  });
  const updated = snapToDoc(
    await db().collection("property_members").doc(memberId).get()
  );
  if (!updated) {
    throw new Error("NOT_FOUND");
  }
  const profile = await loadProfileRaw(String(updated.app_profile_id || ""));
  return mapMemberToClient(updated, profile);
}

/**
 * Owner-only: revoke an active member.
 * @param {string} appProfileId Caller.
 * @param {string} memberId Member id.
 * @return {Promise<boolean>} True when revoked.
 */
export async function revokePropertyMember(
  appProfileId: string,
  memberId: string
): Promise<boolean> {
  const member = snapToDoc(
    await db().collection("property_members").doc(memberId).get()
  );
  if (!member) {
    return false;
  }
  await requirePropertyAccess(
    appProfileId,
    String(member.property_id),
    "owner"
  );
  await db().collection("property_members").doc(memberId).update({
    status: "revoked",
    date_updated: nowIso(),
  });
  return true;
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
    invite_email: invite.invite_email ?? null,
    invite_phone: invite.invite_phone ?? null,
    expires_at: invite.expires_at ?? null,
    property_label: prop ? propertyLabel(prop) : "a property",
  };
}

/**
 * Property ids the profile can access as an active collaborator.
 * @param {string} appProfileId Profile id.
 * @return {Promise<Array<{propertyId: string, role: PropertyRole}>>} Shared.
 */
export async function listSharedPropertyIdsForProfile(
  appProfileId: string
): Promise<Array<{propertyId: string; role: Exclude<PropertyRole, "owner">}>> {
  const snap = await db()
    .collection("property_members")
    .where("app_profile_id", "==", appProfileId)
    .where("status", "==", "active")
    .limit(100)
    .get();
  const out: Array<{
    propertyId: string;
    role: Exclude<PropertyRole, "owner">;
  }> = [];
  for (const d of snap.docs) {
    const doc = snapToDoc(d);
    if (!doc?.property_id) continue;
    const raw = String(doc.role || "").toLowerCase();
    out.push({
      propertyId: String(doc.property_id),
      role: raw === "edit" ? "edit" : "view",
    });
  }
  return out;
}

/**
 * Map property for a caller with role fields.
 * @param {FsDoc} doc Property.
 * @param {string} callerProfileId Caller.
 * @param {PropertyRole} role Resolved role.
 * @return {Record<string, unknown>} Client property.
 */
export function mapPropertyWithRole(
  doc: FsDoc,
  callerProfileId: string,
  role: PropertyRole
): Record<string, unknown> {
  const ownerId = String(doc.app_profile_id || "");
  return {
    ...mapPropertyToClient(doc, ownerId),
    owner_app_profile_id: ownerId,
    my_role: role,
    // Keep app_profile_id as owner id for legacy clients.
    viewer_app_profile_id: callerProfileId,
  };
}
