/**
 * Photo–space assignments (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {
  fetchPhotoById,
  requirePropertyAccess,
  isSpaceOnProperty,
} from "./access";
import {mapAssignmentToClient} from "./mappers";

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} photoId Photo id.
 * @param {string} spaceId Space id.
 * @return {Promise<Record<string, unknown>>} Created assignment.
 */
export async function createAssignment(
  appProfileId: string,
  photoId: string,
  spaceId: string
): Promise<Record<string, unknown>> {
  const raw = await fetchPhotoById(photoId);
  if (!raw) {
    throw new Error("PHOTO_NOT_FOUND");
  }
  const propertyId = String(raw.property_id || "");
  if (!propertyId) {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(appProfileId, propertyId, "edit");
  if (!(await isSpaceOnProperty(propertyId, spaceId))) {
    throw new Error("BAD_SPACE");
  }
  const ts = nowIso();
  const ref = db().collection("photo_assignments").doc();
  await ref.set({
    photo_id: photoId,
    space_id: spaceId,
    status: "confirmed",
    confirmed_by_app_profile: appProfileId,
    confirmed_at: ts,
    method: "manual",
    date_created: ts,
    date_updated: ts,
  });
  // Keep photo in sync with assignment.
  await db().collection("photos").doc(photoId).update({
    space_id: spaceId,
    assignment_status: "confirmed",
    date_updated: ts,
  });
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create assignment failed");
  }
  return mapAssignmentToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} photoId Photo id.
 * @return {Promise<Record<string, unknown>[]>} Assignments for photo.
 */
export async function listAssignmentsForPhoto(
  appProfileId: string,
  photoId: string
): Promise<Record<string, unknown>[]> {
  const raw = await fetchPhotoById(photoId);
  if (!raw) {
    throw new Error("PHOTO_NOT_FOUND");
  }
  const propertyId = String(raw.property_id || "");
  if (!propertyId) {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(appProfileId, propertyId, "view");
  const snap = await db()
    .collection("photo_assignments")
    .where("photo_id", "==", photoId)
    .limit(100)
    .get();
  return snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((d) => mapAssignmentToClient(d));
}
