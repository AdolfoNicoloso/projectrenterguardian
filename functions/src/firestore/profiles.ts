/**
 * App profile bootstrap and CRUD (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {mapAppProfileToClient} from "./mappers";

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
    // Prefer the oldest profile if duplicates exist (legacy race).
    const docs = [...existing.docs].sort((a, b) =>
      String(a.createTime || "").localeCompare(String(b.createTime || ""))
    );
    const primary = docs[0];
    const id = primary.id;
    if (docs.length > 1) {
      console.warn(
        "[getOrCreateAppProfile] duplicate profiles for uid",
        params.uid,
        docs.map((d) => d.id)
      );
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
