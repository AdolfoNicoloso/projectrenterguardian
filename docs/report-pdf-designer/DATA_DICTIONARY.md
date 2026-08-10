# Data dictionary — Report PDF context

Engineering fills this object before rendering. **Use only these Handlebars names** in `template_v4.html`. Request new fields in `NOTES.md` under “requested additions.”

In HTML/preview, photos use `src`. On the server today, photos are JPEG buffers mapped to images at render time.

---

## Top-level: `ReportPdfContext`

| Field | Type | Required | Meaning | Empty-state |
|-------|------|----------|----------|-------------|
| `title` | string | yes | Cover title, e.g. `Move-Out — Oak St Apt` | Show as-is |
| `reportTypeLabel` | string | yes | Human type: Move-In, Move-Out, Tour, Check-in, … | Show as-is |
| `tenantName` | string | yes | Profile display name | Em dash if blank string |
| `address` | string | yes | Property free-text address | Em dash if empty |
| `nickname` | string | no | Friendly property name | Hide “Property” row if missing |
| `generatedAt` | string | yes | When PDF was generated (prefer a human-readable display string at fill time) | Show as-is |
| `summaryNotes` | string | no | Tenant’s overall notes | Hide “Your notes” block if empty |
| `counts` | object | no | Summary counts | Treat missing keys as 0 |
| `counts.spaces_count` | number | no | Spaces in report | 0 |
| `counts.photos_count` | number | no | Photo count for summary | 0 |
| `counts.notes_count` | number | no | Notes count for summary | 0 |
| `baselineInspectionId` | string \| null | no | Linked move-in baseline id (move-out) | Hide row if null/empty |
| `spaces` | array | yes | Ordered space sections (may be empty) | Show empty summary only |
| `disclaimer` | string | yes | Legal/product disclaimer copy | Always show |
| `photosTruncated` | boolean | yes | True if more photos exist than included | Show warning only if true |
| `photoLimit` | number | yes | Max photos embedded (currently 40) | Use in truncation message |

---

## `spaces[]` — `ReportPdfSpaceSection`

| Field | Type | Required | Meaning | Empty-state |
|-------|------|----------|----------|-------------|
| `spaceId` | string | yes | Internal id (do not show unless needed) | — |
| `displayName` | string | yes | Space title (Kitchen, Bedroom 1, …) | Required |
| `notes` | string | no | Space-level notes | Hide notes block if empty |
| `comparisonNotes` | array | no | Move-out vs baseline notes | Hide section if empty/missing |
| `photos` | array | yes | Photos for this space (may be `[]`) | Skip gallery if empty |

Overview / unassigned photos may appear as a synthetic space (e.g. displayName `"Overview / unassigned photos"`).

---

## `comparisonNotes[]`

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `note` | string | no | Comparison text |
| `created_at` | string | no | ISO or display timestamp |

Baseline/current photo ids exist in the cloud snapshot but are **not** in this PDF context today. Request side-by-side images as a NOTES addition if needed.

---

## `photos[]` (HTML / designer kit)

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `photoId` | string | yes | Opaque photo id |
| `src` | string | yes (HTML) | Image URL or relative path for preview |
| `caption` | string | no | Optional caption under image |

Server type uses `jpeg: Buffer` instead of `src`; engineering maps buffers → data URIs or temp files when integrating your HTML.

---

## Handlebars cheat sheet

```handlebars
{{title}}
{{reportTypeLabel}}
{{tenantName}}
{{address}}
{{nickname}}
{{generatedAt}}
{{summaryNotes}}
{{counts.spaces_count}}
{{counts.photos_count}}
{{counts.notes_count}}
{{baselineInspectionId}}
{{disclaimer}}
{{photoLimit}}

{{#if nickname}}…{{/if}}
{{#if summaryNotes}}…{{/if}}
{{#if baselineInspectionId}}…{{/if}}
{{#if photosTruncated}}…{{/if}}

{{#each spaces}}
  {{displayName}}
  {{notes}}
  {{#each comparisonNotes}}
    {{note}} {{created_at}}
  {{/each}}
  {{#each photos}}
    <img src="{{src}}" alt="" />
    {{caption}}
  {{/each}}
{{/each}}
```

---

## Cloud mapping (curiosity only — do not call APIs)

| Context field | Typical source |
|---------------|----------------|
| title / type / address / nickname | `reports.snapshot_json` + live property fallback |
| tenantName | Caller’s app profile `name` |
| spaces[].displayName | Firestore `spaces.display_name` |
| spaces[].notes / photos / comparisonNotes | `snapshot_json.spaces_data` + photo downloads |
| disclaimer | Snapshot or product default |
| generatedAt | Generation time (not inspection completed_at) |

Snapshot also stores inspection ids, state codes, and richer counts; most are **not** exposed on the PDF context yet. Ask for additions in NOTES if the design needs them.
