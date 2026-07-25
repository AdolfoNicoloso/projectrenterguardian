/**
 * Property members listing and role / revoke management.
 */

import {db, nowIso, snapToDoc, type FsDoc} from "./db";
import {
  requirePropertyAccess,
  type PropertyRole,
} from "./access";
import {mapPropertyToClient} from "./mappers";
import {getActivePublicShareForProperty} from "./publicShares";
import {
  loadProfileRaw,
  mapInviteToClient,
  mapMemberToClient,
} from "./sharingInternal";

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

  let publicShare: Record<string, unknown> | null = null;
  try {
    publicShare = await getActivePublicShareForProperty(
      appProfileId,
      propertyId
    );
  } catch (err) {
    console.warn("[listPropertyPeople] public share lookup failed", err);
  }

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
    public_share: publicShare,
  };
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
