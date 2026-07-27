/**
 * Mid-tenancy check-in reminders for Active properties.
 *
 * Uses the same notification fan-out pattern as tour reminders.
 * Stamps check_in_reminder_sent_at so we do not double-send.
 */

import {db, nowIso, snapToDoc, toIso} from "./db";

const EARLY_SLACK_MS = 12 * 60 * 60 * 1000; // 12h early
const LATE_SLACK_MS = 7 * 24 * 60 * 60 * 1000; // still fire up to 7d late

/**
 * @param {string} propertyId Property id.
 * @return {Promise<string[]>} Owner + active member profile ids.
 */
async function listPropertyAccessProfileIds(
  propertyId: string
): Promise<string[]> {
  const prop = snapToDoc(
    await db().collection("properties").doc(propertyId).get()
  );
  if (!prop) {
    return [];
  }
  const ids = new Set<string>();
  const ownerId = String(prop.app_profile_id || "");
  if (ownerId) {
    ids.add(ownerId);
  }
  const members = await db()
    .collection("property_members")
    .where("property_id", "==", propertyId)
    .where("status", "==", "active")
    .limit(100)
    .get();
  for (const d of members.docs) {
    const doc = snapToDoc(d);
    const mid = doc?.app_profile_id ? String(doc.app_profile_id) : "";
    if (mid) {
      ids.add(mid);
    }
  }
  return Array.from(ids);
}

/**
 * Scans active properties with an opted-in next_check_in_at.
 * @return {Promise<{checked: number, sent: number}>} Counts.
 */
export async function processDueCheckInReminders(): Promise<{
  checked: number;
  sent: number;
}> {
  const now = Date.now();
  const snap = await db()
    .collection("properties")
    .where("status", "==", "active")
    .where("check_in_reminder_opt_in", "==", true)
    .limit(200)
    .get();

  let checked = 0;
  let sent = 0;

  for (const d of snap.docs) {
    const prop = snapToDoc(d);
    if (!prop) continue;
    if (prop.check_in_reminder_sent_at) continue;
    const dueIso = toIso(prop.next_check_in_at);
    if (!dueIso) continue;
    const dueMs = Date.parse(dueIso);
    if (!Number.isFinite(dueMs)) continue;
    if (now < dueMs - EARLY_SLACK_MS || now > dueMs + LATE_SLACK_MS) {
      continue;
    }

    checked += 1;
    const label =
      String(prop.nickname || "").trim() ||
      String(prop.address_free_text || "your rental");
    const profileIds = await listPropertyAccessProfileIds(d.id);
    if (profileIds.length === 0) continue;

    const ts = nowIso();
    const batch = db().batch();
    for (const appProfileId of profileIds) {
      const ref = db().collection("notifications").doc();
      batch.set(ref, {
        app_profile_id: appProfileId,
        property_id: d.id,
        type: "check_in_reminder",
        title: "Time for a check-in",
        body:
          `Document how ${label} looks now — a quick mid-tenancy record ` +
          "helps protect your deposit.",
        read_at: null,
        date_created: ts,
        date_updated: ts,
      });
    }
    batch.update(db().collection("properties").doc(d.id), {
      check_in_reminder_sent_at: ts,
      date_updated: ts,
    });
    await batch.commit();
    sent += profileIds.length;
  }

  return {checked, sent};
}
