/**
 * Full account deletion: Firestore data, Storage, then Firebase Auth.
 * Does not create profiles — only deletes what already exists.
 */

import * as admin from "firebase-admin";
import {db, snapToDoc} from "./db";
import {deleteMediaFile} from "./storage";

/**
 * Deletes query matches in pages until none remain.
 * @param {FirebaseFirestore.Query} query Collection query.
 * @param {Function} onDoc Per-document deleter.
 * @return {Promise<number>} Number of documents deleted.
 */
async function deleteByQuery(
  query: FirebaseFirestore.Query,
  onDoc: (
    id: string,
    data: FirebaseFirestore.DocumentData
  ) => Promise<void>
): Promise<number> {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(100).get();
    if (snap.empty) {
      break;
    }
    for (const doc of snap.docs) {
      await onDoc(doc.id, doc.data() || {});
      total += 1;
    }
  }
  return total;
}

/**
 * Force-deletes a property and dependents (no ownership check).
 * @param {string} propertyId Property id.
 * @return {Promise<void>}
 */
async function forceDeleteProperty(propertyId: string): Promise<void> {
  await deleteByQuery(
    db().collection("photos").where("property_id", "==", propertyId),
    async (photoId, photo) => {
      await deleteByQuery(
        db().collection("photo_assignments").where("photo_id", "==", photoId),
        async (assignId) => {
          await db().collection("photo_assignments").doc(assignId).delete();
        }
      );
      if (typeof photo.file === "string" && photo.file) {
        await deleteMediaFile(photo.file);
      }
      await db().collection("photos").doc(photoId).delete();
    }
  );

  await deleteByQuery(
    db().collection("reports").where("property_id", "==", propertyId),
    async (id) => {
      await db().collection("reports").doc(id).delete();
    }
  );

  await deleteByQuery(
    db().collection("inspections").where("property_id", "==", propertyId),
    async (inspId) => {
      await deleteByQuery(
        db().collection("inspection_steps")
          .where("inspection_id", "==", inspId),
        async (stepId) => {
          await db().collection("inspection_steps").doc(stepId).delete();
        }
      );
      await db().collection("inspections").doc(inspId).delete();
    }
  );

  await deleteByQuery(
    db().collection("spaces").where("property_id", "==", propertyId),
    async (id) => {
      await db().collection("spaces").doc(id).delete();
    }
  );

  await deleteByQuery(
    db().collection("property_members")
      .where("property_id", "==", propertyId),
    async (id) => {
      await db().collection("property_members").doc(id).delete();
    }
  );

  await deleteByQuery(
    db().collection("property_invites")
      .where("property_id", "==", propertyId),
    async (id) => {
      await db().collection("property_invites").doc(id).delete();
    }
  );

  await db().collection("properties").doc(propertyId).delete();
}

/**
 * Deletes all Firestore/Storage data for one app profile.
 * @param {string} appProfileId Profile id.
 * @return {Promise<Record<string, number>>} Delete counts.
 */
async function deleteProfileData(
  appProfileId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    properties: 0,
    memberships: 0,
    invites_sent: 0,
    inspections: 0,
    preferences: 0,
    media_files: 0,
  };

  counts.properties = await deleteByQuery(
    db().collection("properties")
      .where("app_profile_id", "==", appProfileId),
    async (propertyId) => {
      await forceDeleteProperty(propertyId);
    }
  );

  counts.memberships = await deleteByQuery(
    db().collection("property_members")
      .where("app_profile_id", "==", appProfileId),
    async (id) => {
      await db().collection("property_members").doc(id).delete();
    }
  );

  counts.invites_sent = await deleteByQuery(
    db().collection("property_invites")
      .where("invited_by_app_profile_id", "==", appProfileId),
    async (id) => {
      await db().collection("property_invites").doc(id).delete();
    }
  );

  counts.inspections = await deleteByQuery(
    db().collection("inspections")
      .where("created_by_user_id", "==", appProfileId),
    async (inspId) => {
      await deleteByQuery(
        db().collection("inspection_steps")
          .where("inspection_id", "==", inspId),
        async (stepId) => {
          await db().collection("inspection_steps").doc(stepId).delete();
        }
      );
      await db().collection("inspections").doc(inspId).delete();
    }
  );

  counts.preferences = await deleteByQuery(
    db().collection("user_preferences")
      .where("app_profile_id", "==", appProfileId),
    async (id) => {
      await db().collection("user_preferences").doc(id).delete();
    }
  );

  counts.media_files = await deleteByQuery(
    db().collection("media_files")
      .where("app_profile_id", "==", appProfileId),
    async (id) => {
      await deleteMediaFile(id);
    }
  );

  try {
    const bucket = admin.storage().bucket("project-renter-guardian-media");
    await bucket.deleteFiles({
      prefix: `uploads/${appProfileId}/`,
      force: true,
    });
  } catch (err) {
    console.warn("[deleteAccount] storage prefix delete:", err);
  }

  await db().collection("app_profiles").doc(appProfileId).delete();
  return counts;
}

/**
 * Finds every app_profiles doc for a Firebase Auth uid.
 * @param {string} firebaseUid Auth uid.
 * @return {Promise<string[]>} Profile document ids.
 */
async function findAllProfileIdsForUid(
  firebaseUid: string
): Promise<string[]> {
  const snap = await db()
    .collection("app_profiles")
    .where("firebase_uid", "==", firebaseUid)
    .limit(50)
    .get();
  return snap.docs.map((d) => d.id);
}

/**
 * Deletes every document/file for this Auth user, then the Auth user.
 * @param {string} firebaseUid Firebase Auth uid.
 * @param {string=} knownProfileId Optional profile id from the request.
 * @return {Promise<{profileIds: string[], counts: Record<string, number>}>}
 */
export async function deleteAccountCompletely(
  firebaseUid: string,
  knownProfileId?: string
): Promise<{profileIds: string[]; counts: Record<string, number>}> {
  if (!firebaseUid) {
    throw new Error("VALIDATION");
  }

  const profileIds = new Set(await findAllProfileIdsForUid(firebaseUid));
  if (knownProfileId) {
    profileIds.add(knownProfileId);
  }

  if (profileIds.size === 0) {
    // Still remove Auth so the user cannot sign back into a ghost account.
    console.warn(
      "[deleteAccount] no app_profiles for uid; deleting Auth only",
      firebaseUid
    );
  }

  const totals: Record<string, number> = {
    profiles: 0,
    properties: 0,
    memberships: 0,
    invites_sent: 0,
    inspections: 0,
    preferences: 0,
    media_files: 0,
  };

  for (const profileId of profileIds) {
    // Confirm the profile belongs to this uid when it still exists.
    const existing = snapToDoc(
      await db().collection("app_profiles").doc(profileId).get()
    );
    if (
      existing &&
      existing.firebase_uid &&
      String(existing.firebase_uid) !== firebaseUid
    ) {
      console.warn(
        "[deleteAccount] refusing profile owned by another uid",
        profileId
      );
      continue;
    }

    const counts = await deleteProfileData(profileId);
    totals.profiles += 1;
    for (const [k, v] of Object.entries(counts)) {
      totals[k] = (totals[k] || 0) + v;
    }
  }

  // Verify nothing owned by these profile ids remains.
  for (const profileId of profileIds) {
    const leftoverProps = await db()
      .collection("properties")
      .where("app_profile_id", "==", profileId)
      .limit(1)
      .get();
    const leftoverPrefs = await db()
      .collection("user_preferences")
      .where("app_profile_id", "==", profileId)
      .limit(1)
      .get();
    const leftoverProfile = await db()
      .collection("app_profiles")
      .doc(profileId)
      .get();
    if (
      !leftoverProps.empty ||
      !leftoverPrefs.empty ||
      leftoverProfile.exists
    ) {
      throw new Error("ACCOUNT_DELETE_INCOMPLETE");
    }
  }

  console.log(
    "[deleteAccount] complete",
    JSON.stringify({firebaseUid, profileIds: [...profileIds], totals})
  );

  try {
    await admin.auth().deleteUser(firebaseUid);
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err ?
        String((err as {code: string}).code) :
        "";
    if (code !== "auth/user-not-found") {
      throw err;
    }
  }

  return {profileIds: [...profileIds], counts: totals};
}
