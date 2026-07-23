/**
 * Focused tests for inspection report snapshot merge/count helpers.
 */
import assert from "node:assert/strict";
import {describe, it} from "node:test";

/**
 * Mirrors src/utils/inspectionSnapshot.ts — keep in sync when changing merge
 * rules. Client bundle is not imported from functions/.
 */
type SpacesWalkData = Record<string, {photo_ids?: string[]; notes?: string}>;

type Merged = {
  photo_ids: string[];
  spaces_data: SpacesWalkData;
  space_ids_in_scope: string[];
  user_summary_notes: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ?
    (value as Record<string, unknown>) :
    {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ?
    value.filter((v): v is string => typeof v === "string") :
    [];
}

function mergeInspectionWizardPayload(
  steps: Array<{step_key: string; payload_json?: unknown}>
): Merged {
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
    photo_ids: asStringArray(review.photo_ids).length > 0 ?
      asStringArray(review.photo_ids) :
      asStringArray(overview.photo_ids),
    spaces_data: spacesData,
    space_ids_in_scope: asStringArray(review.space_ids_in_scope).length > 0 ?
      asStringArray(review.space_ids_in_scope) :
      asStringArray(spaces.space_ids_in_scope),
    user_summary_notes: typeof review.user_summary_notes === "string" ?
      review.user_summary_notes :
      "",
  };
}

function countInspectionSnapshot(payload: Merged) {
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
  return {
    spaces_count: payload.space_ids_in_scope.length,
    overview_photos_count: overviewPhotos,
    space_photos_count: spacePhotoIds.size,
    total_photos_count: overviewPhotos + spacePhotoIds.size,
    notes_count: spaceNotes + (payload.user_summary_notes.trim() ? 1 : 0),
  };
}

describe("mergeInspectionWizardPayload", () => {
  it("does not under-count when review step only has summary notes", () => {
    const merged = mergeInspectionWizardPayload([
      {
        step_key: "capture_overview",
        payload_json: {photo_ids: ["p1", "p2"]},
      },
      {
        step_key: "capture_spaces",
        payload_json: {
          space_ids_in_scope: ["s1", "s2"],
          spaces_data: {
            s1: {photo_ids: ["p3"], notes: "scuff"},
            s2: {photo_ids: ["p4", "p5"]},
          },
        },
      },
      {
        step_key: "review",
        payload_json: {user_summary_notes: "overall ok"},
      },
    ]);
    const counts = countInspectionSnapshot(merged);
    assert.equal(counts.spaces_count, 2);
    assert.equal(counts.overview_photos_count, 2);
    assert.equal(counts.space_photos_count, 3);
    assert.equal(counts.total_photos_count, 5);
    assert.equal(counts.notes_count, 2);
  });
});
