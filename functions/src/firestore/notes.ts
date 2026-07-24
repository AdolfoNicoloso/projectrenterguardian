/**
 * Timestamped bullet notes shared by photos and spaces.
 */

import {db, nowIso, snapToDoc} from "./db";

export type NoteEntry = {
  id: string;
  body: string;
  created_at: string;
  created_by_app_profile_id: string;
  created_by_name: string;
  updated_at?: string | null;
  updated_by_app_profile_id?: string | null;
  updated_by_name?: string | null;
};

/**
 * @param {string} appProfileId Profile id.
 * @return {Promise<string>} Display name for notes attribution.
 */
export async function resolveNoteAuthorName(
  appProfileId: string
): Promise<string> {
  const doc = snapToDoc(
    await db().collection("app_profiles").doc(appProfileId).get()
  );
  if (!doc) {
    return "Someone";
  }
  const name = typeof doc.name === "string" ? doc.name.trim() : "";
  if (name) {
    return name;
  }
  const email = typeof doc.email === "string" ? doc.email.trim() : "";
  if (email) {
    return email;
  }
  const phone = typeof doc.phone === "string" ? doc.phone.trim() : "";
  if (phone) {
    return phone;
  }
  return "Someone";
}

/**
 * @return {string} New note id.
 */
export function newNoteId(): string {
  return `note_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Builds a brand-new note stamped for the author.
 * @param {string} body Note text.
 * @param {string} appProfileId Author profile id.
 * @param {string} authorName Author display name.
 * @param {string=} id Optional id.
 * @return {NoteEntry} New entry.
 */
export function createNoteEntry(
  body: string,
  appProfileId: string,
  authorName: string,
  id?: string
): NoteEntry {
  const ts = nowIso();
  return {
    id: id || newNoteId(),
    body: String(body).trim(),
    created_at: ts,
    created_by_app_profile_id: appProfileId,
    created_by_name: authorName,
    updated_at: null,
    updated_by_app_profile_id: null,
    updated_by_name: null,
  };
}

/**
 * Normalizes raw Firestore note fields (array and/or legacy string).
 * @param {unknown} rawEntries notes_entries field.
 * @param {unknown} legacyNotes legacy notes string.
 * @return {NoteEntry[]} Chronological entries.
 */
export function normalizeNotesEntries(
  rawEntries: unknown,
  legacyNotes?: unknown
): NoteEntry[] {
  const out: NoteEntry[] = [];
  if (Array.isArray(rawEntries)) {
    for (const item of rawEntries) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const body = typeof row.body === "string" ? row.body.trim() : "";
      if (!body) continue;
      const id =
        typeof row.id === "string" && row.id.trim() ?
          row.id.trim() :
          newNoteId();
      out.push({
        id,
        body,
        created_at:
          typeof row.created_at === "string" && row.created_at ?
            row.created_at :
            nowIso(),
        created_by_app_profile_id:
          typeof row.created_by_app_profile_id === "string" ?
            row.created_by_app_profile_id :
            "",
        created_by_name:
          typeof row.created_by_name === "string" &&
          row.created_by_name.trim() ?
            row.created_by_name.trim() :
            "Someone",
        updated_at:
          typeof row.updated_at === "string" && row.updated_at ?
            row.updated_at :
            null,
        updated_by_app_profile_id:
          typeof row.updated_by_app_profile_id === "string" ?
            row.updated_by_app_profile_id :
            null,
        updated_by_name:
          typeof row.updated_by_name === "string" &&
          row.updated_by_name.trim() ?
            row.updated_by_name.trim() :
            null,
      });
    }
  }

  if (
    out.length === 0 &&
    typeof legacyNotes === "string" &&
    legacyNotes.trim()
  ) {
    out.push({
      id: newNoteId(),
      body: legacyNotes.trim(),
      created_at: nowIso(),
      created_by_app_profile_id: "",
      created_by_name: "Someone",
      updated_at: null,
      updated_by_app_profile_id: null,
      updated_by_name: null,
    });
  }

  out.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return out;
}

/**
 * Merges a client-submitted notes list with existing entries.
 * Authorship for creates/edits is always stamped server-side.
 * @param {NoteEntry[]} existing Current entries.
 * @param {unknown} incoming Client payload.
 * @param {string} appProfileId Acting profile id.
 * @param {string} authorName Acting display name.
 * @return {NoteEntry[]} Merged chronological list.
 */
export function mergeNotesEntries(
  existing: NoteEntry[],
  incoming: unknown,
  appProfileId: string,
  authorName: string
): NoteEntry[] {
  if (!Array.isArray(incoming)) {
    return existing;
  }
  const byId = new Map(existing.map((e) => [e.id, e]));
  const next: NoteEntry[] = [];
  const seen = new Set<string>();

  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!body) continue;
    const id =
      typeof row.id === "string" && row.id.trim() ?
        row.id.trim() :
        newNoteId();
    if (seen.has(id)) continue;
    seen.add(id);

    const prev = byId.get(id);
    if (!prev) {
      next.push(createNoteEntry(body, appProfileId, authorName, id));
      continue;
    }
    if (prev.body === body) {
      next.push(prev);
      continue;
    }
    next.push({
      ...prev,
      body,
      updated_at: nowIso(),
      updated_by_app_profile_id: appProfileId,
      updated_by_name: authorName,
    });
  }

  next.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return next;
}

/**
 * Flat text for legacy consumers / search.
 * @param {NoteEntry[]} entries Notes.
 * @return {string|null} Joined bodies or null.
 */
export function notesEntriesToLegacyText(
  entries: NoteEntry[]
): string | null {
  if (!entries.length) {
    return null;
  }
  return entries.map((e) => e.body).join("\n");
}
