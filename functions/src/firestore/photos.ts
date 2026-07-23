/**
 * Photo listing and CRUD (Firestore). Storage upload lives in storage.ts.
 */

import {db, nowIso, snapToDoc} from "./db";
import {
  fetchPhotoById,
  requirePropertyAccess,
  isSpaceOnProperty,
} from "./access";
import {mapPhotoToClient} from "./mappers";
import {deleteMediaFile} from "./storage";
import {
  createNoteEntry,
  mergeNotesEntries,
  normalizeNotesEntries,
  notesEntriesToLegacyText,
  resolveNoteAuthorName,
  type NoteEntry,
} from "./notes";

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @param {string|undefined} spaceId Optional space filter.
 * @param {string|undefined} statusFilter assigned | unassigned.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped photos.
 */
export async function listPhotosForProperty(
  appProfileId: string,
  propertyId: string,
  spaceId?: string,
  statusFilter?: string
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
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((d) => mapPhotoToClient(d));

  if (statusFilter === "assigned") {
    photos = photos.filter((p) => {
      const hasSpace = p.space && String(p.space).length > 0;
      return p.assignment_status === "confirmed" || hasSpace;
    });
  } else if (statusFilter === "unassigned") {
    photos = photos.filter((p) => {
      const hasSpace = p.space && String(p.space).length > 0;
      return p.assignment_status === "unassigned" && !hasSpace;
    });
  }
  return photos;
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
    /** Legacy single-string note; converted to notes_entries when array omitted. */
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
    } else {
      data.space_id = "";
      if (input.assignment_status === undefined) {
        data.assignment_status = "unassigned";
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
