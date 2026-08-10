/**
 * Unit test: report PDF template produces a non-empty PDF buffer.
 */

import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {buildReportPdf, TEMPLATE_VERSION} from "../src/pdf/reportTemplate";

describe("buildReportPdf", () => {
  it("returns a PDF buffer with a header for a text-only snapshot", async () => {
    const buf = await buildReportPdf({
      title: "Move-In — Test Place",
      reportTypeLabel: "Move-In",
      tenantName: "Test Renter",
      address: "123 Main St",
      nickname: "Test Place",
      generatedAt: new Date().toISOString(),
      summaryNotes: "Looks good overall.",
      counts: {spaces_count: 1, photos_count: 0, notes_count: 1},
      spaces: [
        {
          spaceId: "s1",
          displayName: "Bedroom",
          notes: "Small scuff on baseboard.",
          photos: [],
        },
      ],
      disclaimer: "User documentation; not legal advice.",
      photosTruncated: false,
      photoLimit: 40,
    });
    assert.ok(buf.length > 200);
    assert.equal(buf.subarray(0, 4).toString("utf8"), "%PDF");
    assert.equal(TEMPLATE_VERSION, "1");
  });
});
