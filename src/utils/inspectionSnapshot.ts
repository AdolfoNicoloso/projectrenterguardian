/**
 * Merge wizard step payloads so review / report counts see the full walk.
 * Each step only persists its own fields; without merging, review and the
 * final report under-count spaces, photos, and notes.
 */

import type { InspectionStep } from '../types';

export type SpacesWalkData = Record<
  string,
  { photo_ids?: string[]; notes?: string }
>;

export type MergedInspectionWizardPayload = {
  photo_ids: string[];
  spaces_data: SpacesWalkData;
  space_ids_in_scope: string[];
  user_summary_notes: string;
  walk?: {
    current_space_id?: string | null;
    completed_space_ids?: string[];
    phase?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Prefer later steps when the same field exists on multiple steps.
 */
export function mergeInspectionWizardPayload(
  steps: InspectionStep[]
): MergedInspectionWizardPayload {
  const byKey: Record<string, Record<string, unknown>> = {};
  for (const step of steps) {
    byKey[step.step_key] = asRecord(step.payload_json);
  }

  const overview = byKey.capture_overview || {};
  const spaces = byKey.capture_spaces || {};
  const review = byKey.review || {};

  const spacesData = {
    ...asRecord(spaces.spaces_data),
    ...asRecord(review.spaces_data),
  } as SpacesWalkData;

  return {
    photo_ids:
      asStringArray(review.photo_ids).length > 0
        ? asStringArray(review.photo_ids)
        : asStringArray(overview.photo_ids),
    spaces_data: spacesData,
    space_ids_in_scope:
      asStringArray(review.space_ids_in_scope).length > 0
        ? asStringArray(review.space_ids_in_scope)
        : asStringArray(spaces.space_ids_in_scope),
    user_summary_notes:
      typeof review.user_summary_notes === 'string'
        ? review.user_summary_notes
        : typeof spaces.user_summary_notes === 'string'
          ? spaces.user_summary_notes
          : '',
    walk: asRecord(spaces.walk) as MergedInspectionWizardPayload['walk'],
  };
}

export type InspectionSnapshotCounts = {
  spaces_count: number;
  overview_photos_count: number;
  space_photos_count: number;
  total_photos_count: number;
  /** Photos or spaces that have non-empty notes, plus summary notes if present. */
  notes_count: number;
};

/**
 * Derive accurate summary counts for review UI and report snapshots.
 */
export function countInspectionSnapshot(payload: MergedInspectionWizardPayload): InspectionSnapshotCounts {
  const overviewPhotos = payload.photo_ids.length;
  const spacePhotoIds = new Set<string>();
  let spaceNotes = 0;

  for (const spaceId of Object.keys(payload.spaces_data)) {
    const entry = payload.spaces_data[spaceId];
    for (const id of entry?.photo_ids || []) {
      spacePhotoIds.add(id);
    }
    if (entry?.notes && String(entry.notes).trim()) {
      spaceNotes += 1;
    }
  }

  const summaryNote = payload.user_summary_notes.trim() ? 1 : 0;

  return {
    spaces_count: payload.space_ids_in_scope.length,
    overview_photos_count: overviewPhotos,
    space_photos_count: spacePhotoIds.size,
    total_photos_count: overviewPhotos + spacePhotoIds.size,
    notes_count: spaceNotes + summaryNote,
  };
}
