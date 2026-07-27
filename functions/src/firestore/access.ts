/**
 * Property access control: owner + collaborators (edit / view).
 */

import {db, snapToDoc, type FsDoc} from "./db";
import {siblingAppProfileIds} from "./profiles";

export type PropertyRole = "owner" | "edit" | "view";

export type PropertyAccess = {
  property: FsDoc;
  role: PropertyRole;
};

const ROLE_RANK: Record<PropertyRole, number> = {
  view: 1,
  edit: 2,
  owner: 3,
};

/**
 * @param {PropertyRole} role Caller role.
 * @param {PropertyRole} min Minimum required role.
 * @return {boolean} Whether role meets the minimum.
 */
export function roleMeetsMinimum(
  role: PropertyRole,
  min: PropertyRole
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Loads a property and resolves the caller's role (owner or active member).
 * Considers all app_profiles sharing the same Firebase uid (legacy duplicates).
 * @param {string} appProfileId Caller profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<PropertyAccess|null>} Access or null if none.
 */
export async function getPropertyAccess(
  appProfileId: string,
  propertyId: string
): Promise<PropertyAccess | null> {
  const snap = await db().collection("properties").doc(propertyId).get();
  const property = snapToDoc(snap);
  if (!property) {
    return null;
  }
  const profileIds = await siblingAppProfileIds(appProfileId);
  const ownerId = String(property.app_profile_id || "");
  if (ownerId && profileIds.includes(ownerId)) {
    return {property, role: "owner"};
  }
  for (const profileId of profileIds) {
    const memberSnap = await db()
      .collection("property_members")
      .where("property_id", "==", propertyId)
      .where("app_profile_id", "==", profileId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (memberSnap.empty) continue;
    const member = snapToDoc(memberSnap.docs[0]);
    const raw = String(member?.role || "").toLowerCase();
    const role: PropertyRole = raw === "edit" ? "edit" : "view";
    return {property, role};
  }
  return null;
}

/**
 * @param {string} appProfileId Caller profile id.
 * @param {string} propertyId Property id.
 * @param {PropertyRole} minRole Minimum required role.
 * @return {Promise<PropertyAccess>} Access when allowed.
 */
export async function requirePropertyAccess(
  appProfileId: string,
  propertyId: string,
  minRole: PropertyRole
): Promise<PropertyAccess> {
  const access = await getPropertyAccess(appProfileId, propertyId);
  // Missing property / no membership → NOT_FOUND (do not leak existence).
  if (!access) {
    throw new Error("NOT_FOUND");
  }
  // Known member with insufficient role → clear 403.
  if (!roleMeetsMinimum(access.role, minRole)) {
    throw new Error("FORBIDDEN");
  }
  return access;
}

/**
 * Owner-only helper (legacy name). Prefer getPropertyAccess /
 * requirePropertyAccess.
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<FsDoc|null>} Property doc if owned.
 */
export async function fetchPropertyIfOwned(
  appProfileId: string,
  propertyId: string
): Promise<FsDoc | null> {
  const access = await getPropertyAccess(appProfileId, propertyId);
  if (!access || access.role !== "owner") {
    return null;
  }
  return access.property;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<boolean>} Whether owned.
 */
export async function isPropertyOwned(
  appProfileId: string,
  propertyId: string
): Promise<boolean> {
  return (await fetchPropertyIfOwned(appProfileId, propertyId)) != null;
}

/**
 * @param {string} propertyId Property id.
 * @param {string} spaceId Space id.
 * @return {Promise<boolean>} Whether space belongs to property.
 */
export async function isSpaceOnProperty(
  propertyId: string,
  spaceId: string
): Promise<boolean> {
  const snap = await db().collection("spaces").doc(spaceId).get();
  const doc = snapToDoc(snap);
  return doc != null && doc.property_id === propertyId;
}

/**
 * @param {string} photoId Photo id.
 * @return {Promise<FsDoc|null>} Photo doc or null.
 */
export async function fetchPhotoById(
  photoId: string
): Promise<FsDoc | null> {
  const snap = await db().collection("photos").doc(photoId).get();
  return snapToDoc(snap);
}

/**
 * Ensures the caller can access a media file.
 * Allowed when:
 * - the file is linked to a photo on a property they can access, or
 * - the file is the property's application PDF, or
 * - they (or a sibling profile) own the media_files row.
 * @param {string} appProfileId Caller profile id.
 * @param {string} fileId Storage / media_files id.
 * @return {Promise<boolean>} True when allowed.
 */
export async function canAccessFile(
  appProfileId: string,
  fileId: string
): Promise<boolean> {
  const snap = await db()
    .collection("photos")
    .where("file", "==", fileId)
    .limit(1)
    .get();
  if (!snap.empty) {
    const photo = snapToDoc(snap.docs[0]);
    const propertyId = photo?.property_id;
    if (typeof propertyId === "string" && propertyId) {
      const access = await getPropertyAccess(appProfileId, propertyId);
      if (access != null) {
        return true;
      }
    }
  }

  // Application PDFs are stored on properties.application_file (no photo row).
  const appSnap = await db()
    .collection("properties")
    .where("application_file", "==", fileId)
    .limit(1)
    .get();
  if (!appSnap.empty) {
    const property = snapToDoc(appSnap.docs[0]);
    if (property?.id) {
      const access = await getPropertyAccess(appProfileId, property.id);
      if (access != null) {
        return true;
      }
    }
  }

  // Uploader can read their own media_files row.
  const mediaSnap = await db().collection("media_files").doc(fileId).get();
  const media = snapToDoc(mediaSnap);
  const ownerId = media?.app_profile_id;
  if (typeof ownerId === "string" && ownerId) {
    const profileIds = await siblingAppProfileIds(appProfileId);
    if (profileIds.includes(ownerId)) {
      return true;
    }
  }

  return false;
}
