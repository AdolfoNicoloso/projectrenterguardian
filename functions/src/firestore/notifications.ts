/**
 * In-app notifications (invite alerts, tour reminders, etc.).
 * Clients never read Firestore; all access is via Cloud Functions.
 */

import {db, nowIso, snapToDoc, type FsDoc} from "./db";

export type NotificationType =
  | "property_invite"
  | "tour_reminder_1d"
  | "tour_reminder_30m";

/**
 * @param {FsDoc} doc Notification document.
 * @return {Record<string, unknown>} Client payload.
 */
export function mapNotificationToClient(doc: FsDoc): Record<string, unknown> {
  return {
    id: doc.id,
    app_profile_id: doc.app_profile_id,
    property_id: doc.property_id ?? null,
    type: doc.type,
    title: doc.title ?? "",
    body: doc.body ?? "",
    invite_id: doc.invite_id ?? null,
    invite_token: doc.invite_token ?? null,
    tour_scheduled_at: doc.tour_scheduled_at ?? null,
    read_at: doc.read_at ?? null,
    date_created: doc.date_created ?? null,
    date_updated: doc.date_updated ?? null,
  };
}

/**
 * Write a single notification for a profile.
 * @param {object} input Notification fields.
 * @return {Promise<string>} New notification id.
 */
export async function createNotification(input: {
  appProfileId: string;
  propertyId?: string | null;
  type: NotificationType | string;
  title: string;
  body: string;
  inviteId?: string | null;
  inviteToken?: string | null;
  tourScheduledAt?: string | null;
}): Promise<string> {
  const ts = nowIso();
  const ref = db().collection("notifications").doc();
  await ref.set({
    app_profile_id: input.appProfileId,
    property_id: input.propertyId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    invite_id: input.inviteId ?? null,
    invite_token: input.inviteToken ?? null,
    tour_scheduled_at: input.tourScheduledAt ?? null,
    read_at: null,
    date_created: ts,
    date_updated: ts,
  });
  return ref.id;
}

/**
 * Avoid duplicate pending invite notifications for the same invite + profile.
 * @param {string} appProfileId Profile id.
 * @param {string} inviteId Invite id.
 * @return {Promise<boolean>} True if a notification already exists.
 */
export async function hasInviteNotification(
  appProfileId: string,
  inviteId: string
): Promise<boolean> {
  const snap = await db()
    .collection("notifications")
    .where("app_profile_id", "==", appProfileId)
    .where("invite_id", "==", inviteId)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * List notifications for a profile (newest first).
 * @param {string} appProfileId Caller profile.
 * @param {object=} opts Options.
 * @param {number=} opts.limit Max rows.
 * @return {Promise<{notifications: object[], unread_count: number}>}
 */
export async function listNotificationsForProfile(
  appProfileId: string,
  opts?: {limit?: number}
): Promise<{notifications: Record<string, unknown>[]; unread_count: number}> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const snap = await db()
    .collection("notifications")
    .where("app_profile_id", "==", appProfileId)
    .orderBy("date_created", "desc")
    .limit(limit)
    .get();

  const notifications = snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((d) => mapNotificationToClient(d));

  const unreadSnap = await db()
    .collection("notifications")
    .where("app_profile_id", "==", appProfileId)
    .where("read_at", "==", null)
    .limit(100)
    .get();
  const unreadCount = unreadSnap.size;
  return {notifications, unread_count: unreadCount};
}

/**
 * Mark a notification as read (caller must own it).
 * @param {string} appProfileId Caller.
 * @param {string} notificationId Notification id.
 * @return {Promise<Record<string, unknown>>} Updated notification.
 */
export async function markNotificationRead(
  appProfileId: string,
  notificationId: string
): Promise<Record<string, unknown>> {
  const ref = db().collection("notifications").doc(notificationId);
  const doc = snapToDoc(await ref.get());
  if (!doc || String(doc.app_profile_id) !== appProfileId) {
    throw new Error("NOT_FOUND");
  }
  if (doc.read_at) {
    return mapNotificationToClient(doc);
  }
  const ts = nowIso();
  await ref.update({read_at: ts, date_updated: ts});
  const updated = snapToDoc(await ref.get());
  if (!updated) {
    throw new Error("NOT_FOUND");
  }
  return mapNotificationToClient(updated);
}

/**
 * Mark all unread notifications as read for a profile.
 * @param {string} appProfileId Caller.
 * @return {Promise<number>} Number marked.
 */
export async function markAllNotificationsRead(
  appProfileId: string
): Promise<number> {
  const snap = await db()
    .collection("notifications")
    .where("app_profile_id", "==", appProfileId)
    .where("read_at", "==", null)
    .limit(100)
    .get();
  if (snap.empty) {
    return 0;
  }
  const ts = nowIso();
  const batch = db().batch();
  for (const d of snap.docs) {
    batch.update(d.ref, {read_at: ts, date_updated: ts});
  }
  await batch.commit();
  return snap.size;
}

/**
 * Mark invite-related notifications as read after accept/dismiss.
 * @param {string} appProfileId Profile id.
 * @param {string} inviteId Invite id.
 * @return {Promise<void>}
 */
export async function markInviteNotificationsRead(
  appProfileId: string,
  inviteId: string
): Promise<void> {
  const snap = await db()
    .collection("notifications")
    .where("app_profile_id", "==", appProfileId)
    .where("invite_id", "==", inviteId)
    .limit(20)
    .get();
  if (snap.empty) {
    return;
  }
  const ts = nowIso();
  const batch = db().batch();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.read_at) continue;
    batch.update(d.ref, {read_at: ts, date_updated: ts});
  }
  await batch.commit();
}
