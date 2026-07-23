/**
 * Property CRUD and cascade delete (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {getPropertyAccess, requirePropertyAccess} from "./access";
import {isValidPropertyStatus} from "./propertyStatuses";
import {deleteMediaFile} from "./storage";
import {
  listSharedPropertyIdsForProfile,
  mapPropertyWithRole,
} from "./sharing";
import type {SpaceType} from "./spaceTypes";

/** Minimum spaces created with every new property. */
const DEFAULT_PROPERTY_SPACES: ReadonlyArray<{
  space_type: SpaceType;
  display_name: string;
  ordinal: number;
}> = [
  {space_type: "bedroom", display_name: "Bedroom", ordinal: 0},
  {space_type: "bathroom", display_name: "Bathroom", ordinal: 1},
  {space_type: "kitchen", display_name: "Kitchen", ordinal: 2},
  {space_type: "living_room", display_name: "Living room", ordinal: 3},
];

/**
 * @param {string} appProfileId Caller profile id.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped properties.
 */
export async function listPropertiesForAppProfile(
  appProfileId: string
): Promise<Record<string, unknown>[]> {
  const ownedSnap = await db()
    .collection("properties")
    .where("app_profile_id", "==", appProfileId)
    .limit(100)
    .get();
  const byId = new Map<string, Record<string, unknown>>();

  for (const d of ownedSnap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    byId.set(doc.id, mapPropertyWithRole(doc, appProfileId, "owner"));
  }

  const shared = await listSharedPropertyIdsForProfile(appProfileId);
  for (const {propertyId, role} of shared) {
    if (byId.has(propertyId)) continue;
    const doc = snapToDoc(
      await db().collection("properties").doc(propertyId).get()
    );
    if (!doc) continue;
    byId.set(propertyId, mapPropertyWithRole(doc, appProfileId, role));
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) =>
    String(b.date_created || "").localeCompare(String(a.date_created || ""))
  );
  return rows;
}

/**
 * @param {string} appProfileId Caller profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>|null>} Client property or null.
 */
export async function getPropertyForAppProfile(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown> | null> {
  const access = await getPropertyAccess(appProfileId, propertyId);
  if (!access) {
    return null;
  }
  return mapPropertyWithRole(access.property, appProfileId, access.role);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {object} input Create payload from client.
 * @return {Promise<Record<string, unknown>>} Created property.
 */
export async function createPropertyWithDefaultSpaces(
  appProfileId: string,
  input: {
    address_free_text: string;
    lease_start_date?: string | null;
    lease_end_date?: string | null;
    lease_term?: number | null;
    tour_scheduled_at?: string | null;
    nickname?: string | null;
    state_code?: string | null;
    street?: string | null;
    unit?: string | null;
    city?: string | null;
    zip?: number | null;
    listing_url?: string | null;
    status?: string | null;
  }
): Promise<Record<string, unknown>> {
  const ts = nowIso();
  const rawStatus = String(input.status || "active").toLowerCase();
  const status = isValidPropertyStatus(rawStatus) ? rawStatus : "active";
  // Lease optional at create for touring and active; set later as needed.
  const hasLease =
    input.lease_start_date != null &&
    String(input.lease_start_date).trim() !== "";
  const leaseStart = hasLease ? String(input.lease_start_date).trim() : null;
  const tourRaw =
    input.tour_scheduled_at != null &&
    String(input.tour_scheduled_at).trim() !== "" ?
      String(input.tour_scheduled_at).trim() :
      null;
  const listingUrl = input.listing_url && String(input.listing_url).trim() ?
    String(input.listing_url).trim() : null;
  const propRef = db().collection("properties").doc();
  await propRef.set({
    app_profile_id: appProfileId,
    address_free_text: input.address_free_text,
    lease_start_date: leaseStart,
    lease_end_date: input.lease_end_date ?? null,
    lease_term: input.lease_term ?? null,
    tour_scheduled_at: tourRaw,
    tour_reminder_1d_sent_at: null,
    tour_reminder_30m_sent_at: null,
    nickname: input.nickname && String(input.nickname).trim() ?
      String(input.nickname).trim() : null,
    state_code: input.state_code ?? null,
    street: input.street ?? null,
    unit: input.unit ?? null,
    city: input.city ?? null,
    zip: input.zip ?? null,
    listing_url: listingUrl,
    status,
    date_created: ts,
    date_updated: ts,
  });

  const batch = db().batch();
  for (const space of DEFAULT_PROPERTY_SPACES) {
    const spaceRef = db().collection("spaces").doc();
    batch.set(spaceRef, {
      property_id: propRef.id,
      space_type: space.space_type,
      display_name: space.display_name,
      ordinal: space.ordinal,
      is_default: true,
      date_created: ts,
      date_updated: ts,
    });
  }
  await batch.commit();

  const doc = snapToDoc(await propRef.get());
  if (!doc) {
    throw new Error("Firestore: create property failed");
  }
  return mapPropertyWithRole(doc, appProfileId, "owner");
}

/**
 * @param {string} appProfileId Caller profile id.
 * @param {string} propertyId Property id.
 * @param {Record<string, unknown>} patch Partial field updates.
 * @return {Promise<Record<string, unknown>>} Updated client property.
 */
export async function updatePropertyForAppProfile(
  appProfileId: string,
  propertyId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const access = await requirePropertyAccess(appProfileId, propertyId, "edit");
  const data: Record<string, unknown> = {date_updated: nowIso()};
  const keys = [
    "nickname",
    "address_free_text",
    "lease_start_date",
    "lease_end_date",
    "lease_term",
    "tour_scheduled_at",
    "state_code",
    "status",
    "street",
    "unit",
    "city",
    "zip",
    "listing_url",
  ] as const;
  for (const k of keys) {
    if (patch[k] !== undefined) {
      if (k === "status") {
        const next = String(patch[k] || "").toLowerCase();
        if (!isValidPropertyStatus(next)) {
          throw new Error("BAD_PROPERTY_STATUS");
        }
        data[k] = next;
      } else if (k === "listing_url") {
        const raw = patch[k];
        data[k] = raw != null && String(raw).trim() ?
          String(raw).trim() : null;
      } else if (k === "tour_scheduled_at") {
        const raw = patch[k];
        data[k] = raw != null && String(raw).trim() ?
          String(raw).trim() : null;
        // Reschedule reminders whenever tour time changes.
        data.tour_reminder_1d_sent_at = null;
        data.tour_reminder_30m_sent_at = null;
      } else {
        data[k] = patch[k];
      }
    }
  }

  // Promoting to Active (status change) requires a lease start.
  const prevStatus = String(access.property.status || "").toLowerCase();
  const nextStatus = String(
    data.status ?? access.property.status ?? ""
  ).toLowerCase();
  const promotingToActive =
    data.status !== undefined &&
    nextStatus === "active" &&
    prevStatus !== "active";
  if (promotingToActive) {
    const leaseFromPatch = data.lease_start_date;
    const leaseExisting = access.property.lease_start_date;
    const lease =
      leaseFromPatch !== undefined ? leaseFromPatch : leaseExisting;
    if (lease == null || String(lease).trim() === "") {
      throw new Error("LEASE_REQUIRED_FOR_ACTIVE");
    }
  }

  const ref = db().collection("properties").doc(propertyId);
  await ref.update(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: update property returned no data");
  }
  return mapPropertyWithRole(doc, appProfileId, access.role);
}

/**
 * Deletes a property and dependent rows + Storage objects. Owner only.
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<boolean>} True if deleted; false if not owned.
 */
export async function deletePropertyCascade(
  appProfileId: string,
  propertyId: string
): Promise<boolean> {
  try {
    await requirePropertyAccess(appProfileId, propertyId, "owner");
  } catch {
    return false;
  }

  const photos = await db()
    .collection("photos")
    .where("property_id", "==", propertyId)
    .get();
  for (const photoSnap of photos.docs) {
    const photo = snapToDoc(photoSnap);
    const assigns = await db()
      .collection("photo_assignments")
      .where("photo_id", "==", photoSnap.id)
      .get();
    for (const a of assigns.docs) {
      await a.ref.delete();
    }
    if (photo && typeof photo.file === "string" && photo.file) {
      await deleteMediaFile(photo.file);
    }
    await photoSnap.ref.delete();
  }

  const reports = await db()
    .collection("reports")
    .where("property_id", "==", propertyId)
    .get();
  for (const r of reports.docs) {
    await r.ref.delete();
  }

  const inspections = await db()
    .collection("inspections")
    .where("property_id", "==", propertyId)
    .get();
  for (const insp of inspections.docs) {
    const steps = await db()
      .collection("inspection_steps")
      .where("inspection_id", "==", insp.id)
      .get();
    for (const s of steps.docs) {
      await s.ref.delete();
    }
    await insp.ref.delete();
  }

  const spaces = await db()
    .collection("spaces")
    .where("property_id", "==", propertyId)
    .get();
  for (const s of spaces.docs) {
    await s.ref.delete();
  }

  const members = await db()
    .collection("property_members")
    .where("property_id", "==", propertyId)
    .get();
  for (const m of members.docs) {
    await m.ref.delete();
  }

  const invites = await db()
    .collection("property_invites")
    .where("property_id", "==", propertyId)
    .get();
  for (const i of invites.docs) {
    await i.ref.delete();
  }

  await db().collection("properties").doc(propertyId).delete();
  return true;
}
