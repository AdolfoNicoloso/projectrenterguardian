/**
 * Tour reminders for Touring properties.
 *
 * Mechanism: Cloud Scheduler runs processDueTourReminders every 5 minutes.
 * For each touring property with tour_scheduled_at, when the 1-day or
 * 30-minute window is due, write a notifications/{id} doc for the owner
 * and every active property member, then stamp tour_reminder_*_sent_at so
 * we do not double-send. No FCM/email provider is wired yet — notification
 * docs are the durable delivery surface (and a hook for future push).
 */

import {db, nowIso, snapToDoc, toIso} from "./db";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
/** How early we may fire a reminder (covers scheduler jitter). */
const EARLY_SLACK_MS = 5 * 60 * 1000;
/** How late we still fire if the scheduler was delayed. */
const LATE_SLACK_MS = 30 * 60 * 1000;

type ReminderKind = "tour_reminder_1d" | "tour_reminder_30m";

/**
 * @param {string} propertyId Property id.
 * @return {Promise<string[]>} Owner + active member profile ids (unique).
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
 * @param {object} params Notification payload.
 * @return {Promise<void>}
 */
async function writeNotifications(params: {
  profileIds: string[];
  propertyId: string;
  kind: ReminderKind;
  title: string;
  body: string;
  tourScheduledAt: string;
}): Promise<void> {
  const ts = nowIso();
  const batch = db().batch();
  for (const appProfileId of params.profileIds) {
    const ref = db().collection("notifications").doc();
    batch.set(ref, {
      app_profile_id: appProfileId,
      property_id: params.propertyId,
      type: params.kind,
      title: params.title,
      body: params.body,
      tour_scheduled_at: params.tourScheduledAt,
      read_at: null,
      date_created: ts,
      date_updated: ts,
    });
  }
  await batch.commit();
}

/**
 * True when `now` is within [target - earlySlack, target + lateSlack].
 * @param {number} nowMs Now.
 * @param {number} targetMs Target fire time.
 * @return {boolean} Whether due.
 */
function isWithinReminderWindow(nowMs: number, targetMs: number): boolean {
  return (
    nowMs >= targetMs - EARLY_SLACK_MS && nowMs <= targetMs + LATE_SLACK_MS
  );
}

/**
 * Scans touring properties and fans out due tour reminders.
 * @return {Promise<{checked: number, sent: number}>} Counts.
 */
export async function processDueTourReminders(): Promise<{
  checked: number;
  sent: number;
}> {
  const now = Date.now();
  const snap = await db()
    .collection("properties")
    .where("status", "in", ["touring", "applied"])
    .limit(200)
    .get();

  let checked = 0;
  let sent = 0;

  for (const d of snap.docs) {
    const prop = snapToDoc(d);
    if (!prop) continue;
    const tourIso = toIso(prop.tour_scheduled_at);
    if (!tourIso) continue;
    const tourMs = Date.parse(tourIso);
    if (!Number.isFinite(tourMs)) continue;

    checked += 1;
    const label =
      String(prop.nickname || "").trim() ||
      String(prop.address_free_text || "your property");
    const profileIds = await listPropertyAccessProfileIds(d.id);
    if (profileIds.length === 0) continue;

    const patch: Record<string, unknown> = {};

    if (
      !prop.tour_reminder_1d_sent_at &&
      isWithinReminderWindow(now, tourMs - ONE_DAY_MS)
    ) {
      await writeNotifications({
        profileIds,
        propertyId: d.id,
        kind: "tour_reminder_1d",
        title: "Tour tomorrow",
        body:
          `Reminder: your personal tour tracker for ${label} is in about ` +
          "1 day. This is not a booking with the landlord or management.",
        tourScheduledAt: tourIso,
      });
      patch.tour_reminder_1d_sent_at = nowIso();
      sent += 1;
    }

    if (
      !prop.tour_reminder_30m_sent_at &&
      isWithinReminderWindow(now, tourMs - THIRTY_MIN_MS)
    ) {
      await writeNotifications({
        profileIds,
        propertyId: d.id,
        kind: "tour_reminder_30m",
        title: "Tour in 30 minutes",
        body:
          `Reminder: your personal tour tracker for ${label} starts in ` +
          "about 30 minutes. This is not a booking with the landlord or " +
          "management.",
        tourScheduledAt: tourIso,
      });
      patch.tour_reminder_30m_sent_at = nowIso();
      sent += 1;
    }

    if (Object.keys(patch).length > 0) {
      patch.date_updated = nowIso();
      await db().collection("properties").doc(d.id).update(patch);
    }
  }

  return {checked, sent};
}
