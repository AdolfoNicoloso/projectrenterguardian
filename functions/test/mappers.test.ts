/**
 * Unit tests for Firestore → client mappers.
 */
import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  mapAppProfileToClient,
  mapPhotoToClient,
  mapPropertyToClient,
} from "../src/firestore/mappers";
import type {FsDoc} from "../src/firestore/db";

describe("mapAppProfileToClient", () => {
  it("maps id and onboarding flag", () => {
    const doc = {
      id: "prof1",
      name: "Ada",
      onboarding_completed: true,
      date_created: "2026-01-01T00:00:00.000Z",
    } as FsDoc;
    const out = mapAppProfileToClient(doc);
    assert.equal(out.id, "prof1");
    assert.equal(out.name, "Ada");
    assert.equal(out.onboarding_completed, true);
    assert.equal((out as {directus_users_id?: string}).directus_users_id, undefined);
  });
});

describe("mapPropertyToClient", () => {
  it("includes owner profile id and address", () => {
    const doc = {
      id: "prop1",
      address_free_text: "1 Main St",
      lease_start_date: "2026-02-01",
      status: "active",
      listing_url: "https://example.com/listing",
    } as FsDoc;
    const out = mapPropertyToClient(doc, "prof1");
    assert.equal(out.id, "prop1");
    assert.equal(out.app_profile_id, "prof1");
    assert.equal(out.address_free_text, "1 Main St");
    assert.equal(out.status, "active");
    assert.equal(out.listing_url, "https://example.com/listing");
    assert.equal(out.tour_scheduled_at, null);
  });

  it("maps tour_scheduled_at for touring properties", () => {
    const doc = {
      id: "prop2",
      address_free_text: "2 Oak Ave",
      status: "touring",
      tour_scheduled_at: "2026-07-24T18:30:00.000Z",
    } as FsDoc;
    const out = mapPropertyToClient(doc, "prof1");
    assert.equal(out.tour_scheduled_at, "2026-07-24T18:30:00.000Z");
  });
});

describe("mapPhotoToClient", () => {
  it("maps file and space ids", () => {
    const doc = {
      id: "ph1",
      property_id: "prop1",
      space_id: "sp1",
      file: "media-abc",
      captured_at: "2026-03-01T12:00:00.000Z",
      assignment_status: "confirmed",
    } as FsDoc;
    const out = mapPhotoToClient(doc);
    assert.equal(out.file, "media-abc");
    assert.equal(out.space, "sp1");
    assert.equal(out.property, "prop1");
    assert.deepEqual(out.notes_entries, []);
  });

  it("maps notes_entries and legacy notes string", () => {
    const doc = {
      id: "ph2",
      property_id: "prop1",
      space_id: "",
      file: "media-xyz",
      captured_at: "2026-03-01T12:00:00.000Z",
      notes_entries: [
        {
          id: "n1",
          body: "scuff",
          created_at: "2026-03-01T12:05:00.000Z",
          created_by_app_profile_id: "prof1",
          created_by_name: "Ada",
        },
      ],
    } as FsDoc;
    const out = mapPhotoToClient(doc);
    assert.equal(Array.isArray(out.notes_entries), true);
    assert.equal((out.notes_entries as {body: string}[])[0].body, "scuff");
    assert.equal(out.notes, "scuff");
  });
});
