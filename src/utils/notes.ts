import type { NoteEntry } from '../types';
import { formatDisplayDate } from './cmsDateTime';

export function newClientNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Chronological (oldest first). */
export function sortNotesChronological(entries: NoteEntry[]): NoteEntry[] {
  return [...entries].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );
}

/**
 * Prefer notes_entries; migrate a legacy plain string into one entry for the UI.
 */
export function coerceNotesEntries(
  entries?: NoteEntry[] | null,
  legacyNotes?: string | null
): NoteEntry[] {
  if (Array.isArray(entries) && entries.length > 0) {
    return sortNotesChronological(
      entries.filter((e) => e && typeof e.body === 'string' && e.body.trim())
    );
  }
  if (legacyNotes && legacyNotes.trim()) {
    return [
      {
        id: newClientNoteId(),
        body: legacyNotes.trim(),
        created_at: new Date().toISOString(),
        created_by_app_profile_id: '',
        created_by_name: 'Someone',
        updated_at: null,
        updated_by_app_profile_id: null,
        updated_by_name: null,
      },
    ];
  }
  return [];
}

export function formatNoteMeta(entry: NoteEntry): string {
  const edited = Boolean(entry.updated_at);
  const whenIso = edited ? entry.updated_at : entry.created_at;
  const when = formatDisplayDate(whenIso, 'datetime') || 'Unknown time';
  const who = edited
    ? entry.updated_by_name || entry.created_by_name || 'Someone'
    : entry.created_by_name || 'Someone';
  if (edited) {
    return `${who} · edited ${when}`;
  }
  return `${who} · ${when}`;
}

export function createLocalNoteEntry(
  body: string,
  authorName: string,
  authorProfileId = ''
): NoteEntry {
  const ts = new Date().toISOString();
  return {
    id: newClientNoteId(),
    body: body.trim(),
    created_at: ts,
    created_by_app_profile_id: authorProfileId,
    created_by_name: authorName || 'You',
    updated_at: null,
    updated_by_app_profile_id: null,
    updated_by_name: null,
  };
}
