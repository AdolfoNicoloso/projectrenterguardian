# ChatGPT rulebook — clean Renter Guardian report template

Copy everything below the line into ChatGPT, then attach `template_v3.html`, `template_v3.css`, and (optional) a screenshot/PDF of the broken pages.

---

## Role

You are cleaning a **print-first US Letter HTML/CSS report template** for Renter Guardian. Fix **formatting / layout / typography / spacing** issues only. Do not redesign the product or invent a new visual system.

## Hard constraints (do not break)

1. **Keep all Handlebars bindings exactly as-is** — `{{...}}`, `{{#if}}`, `{{#each}}`, helper names, and field paths. No renames, no “improvements” to data names.
2. **Do not change document structure order:** cover → summary → space sections → disclaimer → repeating footer.
3. **Page:** US Letter only. Print margins **≥ 0.5 in** (current template uses ~0.65 / 0.58 / 0.72 — keep ≥ 0.5).
4. **Brand tokens only** (unless fixing an obvious typo of these values):
   - Primary `#6F00FF` (accents only — no large purple fills)
   - Text `#191414` · secondary `#404040` · tertiary `#606060`
   - Surfaces `#FFFFFF` / `#F9F9F9` / `#F0F0F0`
   - Borders `#E0E0E0` / `#C0C0C0`
   - Warning `#FF9500` (+ optional tint `#FFF8EF` for notice backgrounds)
5. **Font:** Open Sans 400 / 600 / 700 (existing `@font-face`). No Inter/Roboto/system-only redesign.
6. **Tone:** user documentation — never add “court-ready,” “certified,” or legal-advice language. Footer must keep: *User documentation — not legal advice*.
7. **Preserve class names** used by the template unless you update HTML + CSS together. Keep wrapper class `report`.
8. **Photos:** do not overlay labels on images; keep consistent gutters; prefer `object-fit: contain` in fixed frames; avoid breaking photo cards across pages (`break-inside: avoid` where already used).

## What “formatting errors” means (fix these)

- Uneven gaps, cramped or oversized whitespace between sections
- Misaligned columns / meta rows / definition lists
- Heading hierarchy that looks broken (size/weight/color inconsistent)
- Text overflow, wrapping, or clipping at print edges
- Rules/dividers too heavy, doubled, or colliding with content
- Footer colliding with body content or wrong print position
- Photo grid cells uneven height, stretched images, or uneven gutters
- Empty optional blocks leaving awkward blank bands (prefer existing `{{#if}}` hide behavior)
- Notice/warning box padding/alignment issues
- Screen-preview styles leaking into `@media print` (or the reverse)

## What not to do

- Do not add dashboard chrome, stat-strip clutter, heavy shadows, or card spam
- Do not switch to a dark theme
- Do not add new Handlebars fields
- Do not replace the logo or invent a new wordmark
- Do not “simplify” by deleting disclaimer, cover lockup, or footer
- Do not change sample data / invent PII

## Working method

1. Read `template_v3.html` + `template_v3.css` fully before editing.
2. Prefer **CSS fixes** over HTML rewrites. Touch HTML only when structure is the bug.
3. Keep CSS variables in `:root` as the source of truth; avoid one-off random hexes.
4. Use the spacing scale: 4 / 8 / 16 / 24 / 32 / 48 / 64 px.
5. After edits, list every change in a short bullet list (file + what fixed).
6. Return **complete** updated `template_v3.html` and/or `template_v3.css` (not fragments), unless asked for a patch.

## Typography hierarchy (keep consistent)

| Role | Guidance |
|------|----------|
| Cover title | Largest, bold (700), charcoal |
| Page / section headings | Semibold–bold, clear but smaller than cover |
| Space name | Emphasized over body |
| Body / notes | Regular, readable ~11–15 px in print |
| Meta / labels | Smaller, secondary gray |
| Captions / footer | Smallest, tertiary gray |

Line height: ~1.2 headings · ~1.5 body · looser only for disclaimer.

## Print QA checklist (self-verify before finishing)

- [ ] No content in the page margin dead zone
- [ ] Cover / summary / each space / disclaimer still paginate as separate logical pages where intended
- [ ] Footer readable on every printed page and does not overlap body
- [ ] Truncation notice still uses **warning** styling, not error red
- [ ] With 0 photos, many photos, missing notes: layout still coherent
- [ ] Handlebars placeholders still present and unchanged

## Output format

1. Brief diagnosis (2–5 bullets): what was wrong
2. Full corrected file(s)
3. Change log (bullets)
4. Any remaining risk you could not verify without a print render
