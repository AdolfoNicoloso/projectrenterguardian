/**
 * App profile bootstrap and CRUD (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {mapAppProfileToClient} from "./mappers";

/**
 * All app_profiles ids that share the same Firebase uid as `appProfileId`.
 * Used so duplicate legacy profiles do not hide owned/shared properties.
 * @param {string} appProfileId Known profile id.
 * @return {Promise<string[]>} Sibling ids (always includes appProfileId).
 */
export async function siblingAppProfileIds(
  appProfileId: string
): Promise<string[]> {
  if (!appProfileId) return [];
  const snap = await db().collection("app_profiles").doc(appProfileId).get();
  const uid = snap.data()?.firebase_uid;
  if (typeof uid !== "string" || !uid) {
    return [appProfileId];
  }
  const all = await db()
    .collection("app_profiles")
    .where("firebase_uid", "==", uid)
    .limit(10)
    .get();
  if (all.empty) return [appProfileId];
  const ids = all.docs.map((d) => d.id);
  return ids.includes(appProfileId) ? ids : [appProfileId, ...ids];
}

/**
 * Score a profile by how much property data it holds (owned + memberships).
 * @param {string} profileId App profile id.
 * @return {Promise<number>} Higher = more likely the real account profile.
 */
async function profileDataScore(profileId: string): Promise<number> {
  const [owned, members] = await Promise.all([
    db()
      .collection("properties")
      .where("app_profile_id", "==", profileId)
      .limit(100)
      .get(),
    db()
      .collection("property_members")
      .where("app_profile_id", "==", profileId)
      .where("status", "==", "active")
      .limit(100)
      .get(),
  ]);
  return owned.size * 1000 + members.size;
}

/**
 * Reassign owned properties + memberships from duplicate profiles onto primary.
 * @param {string} primaryId Canonical app profile id.
 * @param {string[]} duplicateIds Other profile ids for the same Firebase uid.
 * @return {Promise<void>}
 */
async function consolidateDuplicateProfiles(
  primaryId: string,
  duplicateIds: string[]
): Promise<void> {
  for (const dupId of duplicateIds) {
    const ownedSnap = await db()
      .collection("properties")
      .where("app_profile_id", "==", dupId)
      .limit(100)
      .get();
    for (const d of ownedSnap.docs) {
      await d.ref.update({
        app_profile_id: primaryId,
        date_updated: nowIso(),
      });
    }

    const memberSnap = await db()
      .collection("property_members")
      .where("app_profile_id", "==", dupId)
      .limit(100)
      .get();
    for (const d of memberSnap.docs) {
      const doc = snapToDoc(d);
      if (!doc) continue;
      const propertyId = String(doc.property_id || "");
      if (!propertyId) continue;

      const existing = await db()
        .collection("property_members")
        .where("property_id", "==", propertyId)
        .where("app_profile_id", "==", primaryId)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!existing.empty) {
        if (String(doc.status || "") === "active") {
          await d.ref.update({
            status: "revoked",
            date_updated: nowIso(),
          });
        }
        continue;
      }
      await d.ref.update({
        app_profile_id: primaryId,
        date_updated: nowIso(),
      });
    }
  }
}

/**
 * Finds or creates an app profile for a Firebase user.
 * @param {object} params Firebase user fields.
 * @param {string} params.uid Firebase UID.
 * @param {string|null} params.email Email or null.
 * @param {string|null} params.name Display name or null.
 * @return {Promise<string>} App profile document id.
 */
export async function getOrCreateAppProfile(params: {
  uid: string;
  email: string | null;
  name: string | null;
  phone?: string | null;
}): Promise<string> {
  const existing = await db()
    .collection("app_profiles")
    .where("firebase_uid", "==", params.uid)
    .limit(10)
    .get();
  if (!existing.empty) {
    const docs = [...existing.docs];
    // Prefer the profile that actually owns/shares properties. Falling back to
    // "oldest createTime" previously hid accounts when an empty duplicate
    // sorted first.
    let primary = docs[0];
    let bestScore = -1;
    for (const d of docs) {
      const score = await profileDataScore(d.id);
      const ta = d.createTime?.toMillis?.() ?? 0;
      const tb = primary.createTime?.toMillis?.() ?? 0;
      if (
        score > bestScore ||
        (score === bestScore &&
          (ta < tb || (ta === tb && d.id.localeCompare(primary.id) < 0)))
      ) {
        bestScore = score;
        primary = d;
      }
    }
    const id = primary.id;
    if (docs.length > 1) {
      const duplicateIds = docs.map((d) => d.id).filter((x) => x !== id);
      console.warn(
        "[getOrCreateAppProfile] duplicate profiles for uid",
        params.uid,
        {primary: id, score: bestScore, all: docs.map((d) => d.id)}
      );
      try {
        await consolidateDuplicateProfiles(id, duplicateIds);
      } catch (err) {
        console.warn("[getOrCreateAppProfile] consolidate failed", err);
      }
    }
    const patch: Record<string, unknown> = {};
    if (params.email) {
      patch.email = params.email;
    }
    if (params.phone) {
      patch.phone = params.phone;
    }
    if (params.name) {
      patch.name = params.name;
    }
    if (Object.keys(patch).length > 0) {
      patch.date_updated = nowIso();
      await db().collection("app_profiles").doc(id).update(patch);
    }
    return id;
  }
  const ts = nowIso();
  const ref = db().collection("app_profiles").doc();
  await ref.set({
    firebase_uid: params.uid,
    email: params.email ?? null,
    phone: params.phone ?? null,
    name: params.name ?? null,
    onboarding_completed: false,
    date_created: ts,
    date_updated: ts,
  });
  return ref.id;
}

/**
 * @param {string} firebaseUid Firebase UID.
 * @return {Promise<Record<string, unknown>|null>} Mapped profile or null.
 */
export async function findAppProfileByFirebaseUid(
  firebaseUid: string
): Promise<Record<string, unknown> | null> {
  const snap = await db()
    .collection("app_profiles")
    .where("firebase_uid", "==", firebaseUid)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const doc = snapToDoc(snap.docs[0]);
  return doc ? mapAppProfileToClient(doc) : null;
}

/**
 * @param {string} appProfileId Profile id.
 * @return {Promise<Record<string, unknown>|null>} Mapped profile or null.
 */
export async function getAppProfile(
  appProfileId: string
): Promise<Record<string, unknown> | null> {
  const doc = snapToDoc(
    await db().collection("app_profiles").doc(appProfileId).get()
  );
  return doc ? mapAppProfileToClient(doc) : null;
}

/**
 * @param {string} appProfileId Profile id.
 * @param {Record<string, unknown>} updates Partial updates.
 * @return {Promise<Record<string, unknown>>} Updated mapped profile.
 */
export async function updateAppProfile(
  appProfileId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const ref = db().collection("app_profiles").doc(appProfileId);
  const existing = snapToDoc(await ref.get());
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  const patch: Record<string, unknown> = {date_updated: nowIso()};
  if (updates.name !== undefined) {
    patch.name = updates.name;
  }
  if (updates.onboarding_completed !== undefined) {
    patch.onboarding_completed = updates.onboarding_completed;
  }
  await ref.update(patch);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: update app-profile returned no data");
  }
  return mapAppProfileToClient(doc);
}
