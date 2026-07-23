/**
 * User preferences (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {mapUserPreferenceToClient} from "./mappers";

/**
 * @param {string} appProfileId App profile id.
 * @return {Promise<Record<string, unknown>|null>} Preferences or null.
 */
export async function getUserPreferences(
  appProfileId: string
): Promise<Record<string, unknown> | null> {
  const snap = await db()
    .collection("user_preferences")
    .where("app_profile_id", "==", appProfileId)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const doc = snapToDoc(snap.docs[0]);
  return doc ? mapUserPreferenceToClient(doc) : null;
}

/**
 * @param {string} appProfileId App profile id.
 * @param {object} input Theme / language updates.
 * @return {Promise<Record<string, unknown>>} Upserted preferences.
 */
export async function upsertUserPreferences(
  appProfileId: string,
  input: {theme_preference?: string; preferred_language?: string}
): Promise<Record<string, unknown>> {
  const existing = await getUserPreferences(appProfileId);
  if (existing && existing.id) {
    const data: Record<string, unknown> = {date_updated: nowIso()};
    if (input.theme_preference !== undefined) {
      data.theme_preference = input.theme_preference;
    }
    if (input.preferred_language !== undefined) {
      data.preferred_language = input.preferred_language;
    }
    const ref = db().collection("user_preferences").doc(String(existing.id));
    await ref.update(data);
    const doc = snapToDoc(await ref.get());
    if (!doc) {
      throw new Error("Firestore: update preferences failed");
    }
    return mapUserPreferenceToClient(doc);
  }
  const ts = nowIso();
  const data: Record<string, unknown> = {
    app_profile_id: appProfileId,
    theme_preference: input.theme_preference || "auto",
    date_created: ts,
    date_updated: ts,
  };
  if (input.preferred_language !== undefined) {
    data.preferred_language = input.preferred_language;
  }
  const ref = db().collection("user_preferences").doc();
  await ref.set(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create preferences failed");
  }
  return mapUserPreferenceToClient(doc);
}
