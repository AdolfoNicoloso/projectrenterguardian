/**
 * Unit tests for Handlebars-like report HTML fill.
 */

import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {fillHandlebars} from "../src/pdf/fillHandlebars";

describe("fillHandlebars", () => {
  it("fills nested each/if blocks", () => {
    const html = fillHandlebars(
      "<h1>{{title}}</h1>{{#each spaces}}<h2>{{displayName}}</h2>" +
        "{{#if notes}}<p>{{notes}}</p>{{/if}}" +
        "{{#each photos}}<img src=\"{{src}}\"/>{{/each}}{{/each}}",
      {
        title: "Report",
        spaces: [
          {
            displayName: "Kitchen",
            notes: "Clean",
            photos: [{src: "data:x"}],
          },
          {displayName: "Bath", notes: "", photos: []},
        ],
      }
    );
    assert.match(html, /Report/);
    assert.match(html, /Kitchen/);
    assert.match(html, /Clean/);
    assert.match(html, /data:x/);
    assert.match(html, /Bath/);
    assert.doesNotMatch(html, /<p><\/p>/);
  });
});
