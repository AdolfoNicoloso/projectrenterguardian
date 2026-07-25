/**
 * Space CRUD (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {requirePropertyAccess} from "./access";
import {mapSpaceToClient} from "./mappers";
import {isValidSpaceType} from "./spaceTypes";
import {
  mergeNotesEntries,
  normalizeNotesEntries,
  notesEntriesToLegacyText,
  resolveNoteAuthorName,
} from "./notes";

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped spaces.
 */
export async function listSpacesForProperty(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown>[]> {
  await requirePropertyAccess(appProfileId, propertyId, "view");
  const snap = await db()
    .collection("spaces")
    .where("property_id", "==", propertyId)
    .limit(200)
    .get();
  const rows = snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null);
  rows.sort((a, b) => {
    const oa = Number(a.ordinal ?? 999);
    const ob = Number(b.ordinal ?? 999);
    if (oa !== ob) return oa - ob;
    return String(a.date_created || "").localeCompare(
      String(b.date_created || "")
    );
  });
  return rows.map((d) => mapSpaceToClient(d));
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {object} input Client body.
 * @return {Promise<Record<string, unknown>>} Created space.
 */
export async function createSpaceForProperty(
  appProfileId: string,
  input: {
    property?: string;
    space_type?: string;
    display_name?: string;
    custom_space_type?: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.property || !input.space_type || !input.display_name) {
    throw new Error("VALIDATION");
  }
  if (!isValidSpaceType(input.space_type)) {
    throw new Error("BAD_SPACE_TYPE");
  }
  await requirePropertyAccess(appProfileId, input.property, "edit");

  // Append after the current max ordinal so new spaces land at the bottom.
  const existingSnap = await db()
    .collection("spaces")
    .where("property_id", "==", input.property)
    .limit(200)
    .get();
  let nextOrdinal = 0;
  for (const d of existingSnap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    const o = Number(doc.ordinal);
    if (Number.isFinite(o) && o >= nextOrdinal) {
      nextOrdinal = o + 1;
    }
  }

  const ts = nowIso();
  const data: Record<string, unknown> = {
    property_id: input.property,
    space_type: input.space_type,
    display_name: String(input.display_name).trim(),
    ordinal: nextOrdinal,
    date_created: ts,
    date_updated: ts,
  };
  if (input.space_type === "custom_space_type" && input.custom_space_type) {
    data.custom_space_type = String(input.custom_space_type).trim();
  }
  const ref = db().collection("spaces").doc();
  await ref.set(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create space failed");
  }
  return mapSpaceToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} spaceId Space id.
 * @param {Record<string, unknown>} patch Fields to update.
 * @return {Promise<Record<string, unknown>>} Updated space.
 */
export async function updateSpaceForProfile(
  appProfileId: string,
  spaceId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cur = snapToDoc(await db().collection("spaces").doc(spaceId).get());
  if (!cur) {
    throw new Error("NOT_FOUND");
  }
  const propId = String(cur.property_id || "");
  if (!propId) {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(appProfileId, propId, "edit");
  const data: Record<string, unknown> = {date_updated: nowIso()};
  if (patch.space_type !== undefined) {
    if (!isValidSpaceType(String(patch.space_type))) {
      throw new Error("BAD_SPACE_TYPE");
    }
    data.space_type = patch.space_type;
  }
  if (patch.display_name !== undefined) {
    data.display_name = patch.display_name;
  }
  if (patch.custom_space_type !== undefined) {
    data.custom_space_type = patch.custom_space_type;
  }
  if (patch.ordinal !== undefined) {
    const n = Number(patch.ordinal);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("VALIDATION");
    }
    data.ordinal = Math.floor(n);
  }
  if (patch.is_default !== undefined) {
    data.is_default = patch.is_default;
  }
  if (patch.notes_entries !== undefined) {
    const authorName = await resolveNoteAuthorName(appProfileId);
    const existing = normalizeNotesEntries(cur.notes_entries, cur.notes);
    const next = mergeNotesEntries(
      existing,
      patch.notes_entries,
      appProfileId,
      authorName
    );
    data.notes_entries = next;
    data.notes = notesEntriesToLegacyText(next);
  }
  const ref = db().collection("spaces").doc(spaceId);
  await ref.update(data);
  const updated = snapToDoc(await ref.get());
  if (!updated) {
    throw new Error("Firestore: update space failed");
  }
  return mapSpaceToClient(updated);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} spaceId Space id.
 * @return {Promise<boolean>} True if deleted.
 */
export async function deleteSpaceForProfile(
  appProfileId: string,
  spaceId: string
): Promise<boolean> {
  const cur = snapToDoc(await db().collection("spaces").doc(spaceId).get());
  if (!cur) {
    return false;
  }
  const propId = String(cur.property_id || "");
  if (!propId) {
    return false;
  }
  try {
    await requirePropertyAccess(appProfileId, propId, "edit");
  } catch {
    return false;
  }

  const ts = nowIso();
  // Unassign photos — do not delete evidence when a space is removed
  const photos = await db()
    .collection("photos")
    .where("space_id", "==", spaceId)
    .get();
  const assignments = await db()
    .collection("photo_assignments")
    .where("space_id", "==", spaceId)
    .get();

  let batch = db().batch();
  let ops = 0;
  const commitIfNeeded = async () => {
    if (ops >= 400) {
      await batch.commit();
      batch = db().batch();
      ops = 0;
    }
  };

  for (const photoSnap of photos.docs) {
    batch.update(photoSnap.ref, {
      space_id: "",
      assignment_status: "unassigned",
      date_updated: ts,
    });
    ops += 1;
    await commitIfNeeded();
  }

  for (const asg of assignments.docs) {
    batch.delete(asg.ref);
    ops += 1;
    await commitIfNeeded();
  }

  batch.delete(db().collection("spaces").doc(spaceId));
  await batch.commit();
  return true;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<boolean>} Whether any inspections exist.
 */
export async function propertyHasInspections(
  appProfileId: string,
  propertyId: string
): Promise<boolean> {
  try {
    await requirePropertyAccess(appProfileId, propertyId, "view");
  } catch {
    return false;
  }
  const snap = await db()
    .collection("inspections")
    .where("property_id", "==", propertyId)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Persist a custom space order for a property (drag-and-drop).
 * @param {string} appProfileId Caller.
 * @param {string} propertyId Property id.
 * @param {string[]} orderedSpaceIds Space ids in desired order.
 * @return {Promise<Record<string, unknown>[]>} Updated spaces list.
 */
export async function reorderSpacesForProperty(
  appProfileId: string,
  propertyId: string,
  orderedSpaceIds: string[]
): Promise<Record<string, unknown>[]> {
  if (!Array.isArray(orderedSpaceIds) || orderedSpaceIds.length === 0) {
    throw new Error("VALIDATION");
  }
  await requirePropertyAccess(appProfileId, propertyId, "edit");

  const uniqueIds = [...new Set(orderedSpaceIds.map(String))];
  const snaps = await Promise.all(
    uniqueIds.map((id) => db().collection("spaces").doc(id).get())
  );

  for (let i = 0; i < snaps.length; i++) {
    const doc = snapToDoc(snaps[i]);
    if (!doc || String(doc.property_id || "") !== propertyId) {
      throw new Error("FORBIDDEN");
    }
  }

  const ts = nowIso();
  let batch = db().batch();
  let ops = 0;
  for (let i = 0; i < uniqueIds.length; i++) {
    batch.update(db().collection("spaces").doc(uniqueIds[i]), {
      ordinal: i,
      date_updated: ts,
    });
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db().batch();
      ops = 0;
    }
  }
  if (ops > 0) {
    await batch.commit();
  }

  return listSpacesForProperty(appProfileId, propertyId);
}
