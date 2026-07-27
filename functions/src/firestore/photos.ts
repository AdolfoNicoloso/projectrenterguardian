/**
 * Photo listing and CRUD (Firestore). Storage upload lives in storage.ts.
 */

import {db, nowIso, snapToDoc} from "./db";
import {
  fetchPhotoById,
  requirePropertyAccess,
  isSpaceOnProperty,
} from "./access";
import {mapPhotoToClient, mapPhotoToGalleryClient} from "./mappers";
import {deleteMediaFile} from "./storage";
import {
  createNoteEntry,
  mergeNotesEntries,
  normalizeNotesEntries,
  notesEntriesToLegacyText,
  resolveNoteAuthorName,
  type NoteEntry,
} from "./notes";

type PhotoDoc = NonNullable<ReturnType<typeof snapToDoc>>;

/**
 * Stable display order: ordinal ascending, then captured_at, then id.
 * @param {PhotoDoc} a Photo doc.
 * @param {PhotoDoc} b Photo doc.
 * @return {number} Compare result.
 */
function comparePhotoOrder(a: PhotoDoc, b: PhotoDoc): number {
  const oa = Number.isFinite(Number(a.ordinal)) ? Number(a.ordinal) : 1e9;
  const ob = Number.isFinite(Number(b.ordinal)) ? Number(b.ordinal) : 1e9;
  if (oa !== ob) return oa - ob;
  const ca = String(a.captured_at || "");
  const cb = String(b.captured_at || "");
  if (ca !== cb) return ca.localeCompare(cb);
  return String(a.id || "").localeCompare(String(b.id || ""));
}

/**
 * Next ordinal for a space (or unassigned when spaceId is empty).
 * @param {string} propertyId Property id.
 * @param {string} spaceId Space id or "".
 * @return {Promise<number>} Next ordinal.
 */
async function nextOrdinalForSpace(
  propertyId: string,
  spaceId: string
): Promise<number> {
  const snap = await db()
    .collection("photos")
    .where("property_id", "==", propertyId)
    .where("space_id", "==", spaceId)
    .limit(500)
    .get();
  let max = -1;
  for (const d of snap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    const o = Number(doc.ordinal);
    if (Number.isFinite(o) && o > max) max = o;
  }
  return max + 1;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @param {string|undefined} spaceId Optional space filter.
 * @param {string|undefined} statusFilter assigned | unassigned.
 * @param {string|undefined} fields gallery = lean DTO without notes.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped photos.
 */
export async function listPhotosForProperty(
  appProfileId: string,
  propertyId: string,
  spaceId?: string,
  statusFilter?: string,
  fields?: string
): Promise<Record<string, unknown>[]> {
  await requirePropertyAccess(appProfileId, propertyId, "view");
  let query = db()
    .collection("photos")
    .where("property_id", "==", propertyId);
  if (spaceId) {
    query = query.where("space_id", "==", spaceId);
  }
  const snap = await query.limit(500).get();
  let photos = snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null);

  if (statusFilter === "assigned") {
    photos = photos.filter((d) => {
      const hasSpace =
        typeof d.space_id === "string" && d.space_id.length > 0;
      return d.assignment_status === "confirmed" || hasSpace;
    });
  } else if (statusFilter === "unassigned") {
    photos = photos.filter((d) => {
      const hasSpace =
        typeof d.space_id === "string" && d.space_id.length > 0;
      return d.assignment_status === "unassigned" && !hasSpace;
    });
  }

  const lean = fields === "gallery";
  return photos
    .slice()
    .sort(comparePhotoOrder)
    .map((d) => (lean ? mapPhotoToGalleryClient(d) : mapPhotoToClient(d)));
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {object} input Photo create body.
 * @return {Promise<Record<string, unknown>>} Created photo.
 */
export async function createPhoto(
  appProfileId: string,
  input: {
    property?: string;
    space?: string;
    file?: string;
    captured_at?: string;
    exif_datetime_original?: string;
    assignment_status?: string;
    /** Legacy single-string note; converted to notes_entries. */
    notes?: string;
    notes_entries?: unknown;
  }
): Promise<Record<string, unknown>> {
  if (!input.property || !input.file || !input.captured_at) {
    throw new Error("VALIDATION");
  }
  await requirePropertyAccess(appProfileId, input.property, "edit");
  if (
    input.space &&
    !(await isSpaceOnProperty(input.property, input.space))
  ) {
    throw new Error("BAD_SPACE");
  }
  const ts = nowIso();
  const authorName = await resolveNoteAuthorName(appProfileId);
  let notesEntries: NoteEntry[] = [];
  if (Array.isArray(input.notes_entries) && input.notes_entries.length > 0) {
    notesEntries = mergeNotesEntries(
      [],
      input.notes_entries,
      appProfileId,
      authorName
    );
  } else if (input.notes && String(input.notes).trim()) {
    notesEntries = [
      createNoteEntry(String(input.notes), appProfileId, authorName),
    ];
  }
  const data: Record<string, unknown> = {
    property_id: input.property,
    file: String(input.file),
    captured_at: input.captured_at,
    uploaded_at: ts,
    space_id: input.space || "",
    assignment_status: input.space ?
      (input.assignment_status || "confirmed") :
      (input.assignment_status || "unassigned"),
    notes_entries: notesEntries,
    notes: notesEntriesToLegacyText(notesEntries),
    ordinal: await nextOrdinalForSpace(input.property, input.space || ""),
    date_created: ts,
    date_updated: ts,
  };
  if (input.exif_datetime_original) {
    data.exif_datetime_original = input.exif_datetime_original;
  }
  const ref = db().collection("photos").doc();
  await ref.set(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create photo failed");
  }
  return mapPhotoToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {object} input Patch body including id.
 * @return {Promise<Record<string, unknown>>} Updated photo.
 */
export async function updatePhoto(
  appProfileId: string,
  input: {
    id?: string;
    property?: string;
    space?: string;
    file?: string;
    assignment_status?: string;
    /** Legacy note string; converted to notes_entries if array omitted. */
    notes?: string;
    notes_entries?: unknown;
  }
): Promise<Record<string, unknown>> {
  if (!input.id) {
    throw new Error("VALIDATION");
  }
  const raw = await fetchPhotoById(input.id);
  if (!raw) {
    throw new Error("NOT_FOUND");
  }
  const propertyId = String(raw.property_id || "");
  if (!propertyId) {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(appProfileId, propertyId, "edit");
  const data: Record<string, unknown> = {date_updated: nowIso()};
  if (input.assignment_status !== undefined) {
    data.assignment_status = input.assignment_status;
  }
  if (input.notes_entries !== undefined || input.notes !== undefined) {
    const authorName = await resolveNoteAuthorName(appProfileId);
    const existing = normalizeNotesEntries(raw.notes_entries, raw.notes);
    let next: NoteEntry[];
    if (input.notes_entries !== undefined) {
      next = mergeNotesEntries(
        existing,
        input.notes_entries,
        appProfileId,
        authorName
      );
    } else if (input.notes && String(input.notes).trim()) {
      // Legacy clients that still PATCH a single string append one note.
      next = [
        ...existing,
        createNoteEntry(String(input.notes), appProfileId, authorName),
      ];
    } else {
      next = [];
    }
    data.notes_entries = next;
    data.notes = notesEntriesToLegacyText(next);
  }
  if (input.file !== undefined) {
    data.file = String(input.file);
  }
  if (input.space !== undefined) {
    if (input.space) {
      if (!(await isSpaceOnProperty(propertyId, input.space))) {
        throw new Error("BAD_SPACE");
      }
      data.space_id = input.space;
      if (input.assignment_status === undefined) {
        data.assignment_status = "confirmed";
      }
      if (String(raw.space_id || "") !== String(input.space)) {
        data.ordinal = await nextOrdinalForSpace(propertyId, input.space);
      }
    } else {
      data.space_id = "";
      if (input.assignment_status === undefined) {
        data.assignment_status = "unassigned";
      }
      if (String(raw.space_id || "") !== "") {
        data.ordinal = await nextOrdinalForSpace(propertyId, "");
      }
    }
  }
  const ref = db().collection("photos").doc(input.id);
  await ref.update(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: update photo failed");
  }
  return mapPhotoToClient(doc);
}

/**
 * Persist photo order within a space or the unassigned tray.
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @param {string} spaceId Space id, or "" for unassigned.
 * @param {string[]} orderedPhotoIds Photo ids left → right.
 * @return {Promise<Record<string, unknown>[]>} Updated photos for the property.
 */
export async function reorderPhotosForProperty(
  appProfileId: string,
  propertyId: string,
  spaceId: string,
  orderedPhotoIds: string[]
): Promise<Record<string, unknown>[]> {
  if (!Array.isArray(orderedPhotoIds) || orderedPhotoIds.length === 0) {
    throw new Error("VALIDATION");
  }
  await requirePropertyAccess(appProfileId, propertyId, "edit");
  const normalizedSpace = spaceId || "";
  if (
    normalizedSpace &&
    !(await isSpaceOnProperty(propertyId, normalizedSpace))
  ) {
    throw new Error("BAD_SPACE");
  }

  const uniqueIds = [...new Set(orderedPhotoIds.map(String))];
  const snaps = await Promise.all(
    uniqueIds.map((id) => db().collection("photos").doc(id).get())
  );

  for (let i = 0; i < snaps.length; i++) {
    const doc = snapToDoc(snaps[i]);
    if (!doc || String(doc.property_id || "") !== propertyId) {
      throw new Error("FORBIDDEN");
    }
    if (String(doc.space_id || "") !== normalizedSpace) {
      throw new Error("FORBIDDEN");
    }
  }

  const ts = nowIso();
  let batch = db().batch();
  let ops = 0;
  for (let i = 0; i < uniqueIds.length; i++) {
    batch.update(db().collection("photos").doc(uniqueIds[i]), {
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

  return listPhotosForProperty(appProfileId, propertyId);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} photoId Photo id.
 * @return {Promise<Record<string, unknown>|null>} Photo or null.
 */
export async function getPhotoForProfile(
  appProfileId: string,
  photoId: string
): Promise<Record<string, unknown> | null> {
  const raw = await fetchPhotoById(photoId);
  if (!raw) {
    return null;
  }
  const propertyId = String(raw.property_id || "");
  if (!propertyId) {
    return null;
  }
  try {
    await requirePropertyAccess(appProfileId, propertyId, "view");
  } catch {
    return null;
  }
  return mapPhotoToClient(raw);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} photoId Photo id.
 * @return {Promise<boolean>} True if deleted.
 */
export async function deletePhotoForProfile(
  appProfileId: string,
  photoId: string
): Promise<boolean> {
  const raw = await fetchPhotoById(photoId);
  if (!raw) {
    return false;
  }
  const propertyId = String(raw.property_id || "");
  if (!propertyId) {
    return false;
  }
  try {
    await requirePropertyAccess(appProfileId, propertyId, "edit");
  } catch {
    return false;
  }
  const assigns = await db()
    .collection("photo_assignments")
    .where("photo_id", "==", photoId)
    .get();
  for (const a of assigns.docs) {
    await a.ref.delete();
  }
  if (typeof raw.file === "string" && raw.file) {
    await deleteMediaFile(raw.file);
  }
  await db().collection("photos").doc(photoId).delete();
  return true;
}
