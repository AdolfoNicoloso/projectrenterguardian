# Renter Guardian — Report PDF Designer Brief

## Paste-ready email (send with this folder)

```
Hi —

We're redesigning the PDF that renters export after documenting a property
(move-in, move-out, tour, check-in, etc.). I'd like you to create a
commercial-grade US Letter template we can drop into our product.

Attached / linked is the designer kit folder: docs/report-pdf-designer/

What's inside:
• BRIEF.md — this brief and constraints
• BRAND_AND_UX.md — our color palettes, typography, spacing, PDF UX rules
• DATA_DICTIONARY.md — every data field the template can use (Handlebars names)
• sample-data.json — realistic fake report data
• template_v4.html + template_v4.css — current commercial Letter template
• preview.html — open this in a browser to see sample data filled in
  (if photos don't load from file://, run a tiny local server — see BRIEF)

What we need back (zip):
1. template_v4.html — same Handlebars field names (don't rename without NOTES)
2. template_v4.css — print-first, US Letter
3. assets/ — logo, icons, textures + license notes
4. fonts/ — embeddable fonts + license confirmation
5. preview/ — optional PNG/PDF of cover, a space page, disclaimer
6. NOTES.md — type/color/spacing decisions + any brand deviations

Please follow BRAND_AND_UX.md (purple + charcoal + gray). Commercial polish
is welcome; inventing a separate palette is not unless you document it.

Thanks!
```

---

## Product context

**Renter Guardian** helps renters document property condition with photos and notes. After an inspection, the app generates a **PDF report** they can open or download.

The PDF is **user documentation** — a personal record. It is **not** legal advice, a professional inspection, or a guarantee of court admissibility. Do not use “court-ready,” “certified,” or similar language.

Today the layout is a plain programmatic PDF. We want a **commercial-grade** Letter template that feels trustworthy, calm, and on-brand.

## How data works (you do not need Firebase)

Engineering fills one JSON object (`ReportPdfContext`) before rendering. You never call the cloud. Design against:

1. Field names in **DATA_DICTIONARY.md**
2. Fake data in **sample-data.json**
3. Handlebars placeholders in **template_v4.html** (`{{title}}`, `{{#each spaces}}`, …)

Photos in HTML use `photos[].src` (path or URL). In production, engineering embeds resized JPEGs.

## Visual goals

- Clean, print-friendly, commercial rental/documentation feel
- Aligned with **BRAND_AND_UX.md** (Open Sans, `#6F00FF` accents, charcoal text)
- Clear hierarchy: cover → summary → spaces (notes + photos) → disclaimer → footer
- Works with 1 space or many; 0 photos or many; optional notes missing

## Hard constraints

| Constraint | Detail |
|------------|--------|
| Page | US Letter (8.5 × 11 in) |
| Margins | ≥ 0.5 in printable |
| Brand | Follow **BRAND_AND_UX.md** |
| Structure | Cover → summary → space sections → disclaimer → footer |
| Photos | Cap **40** total (`photoLimit` / `photosTruncated` warning) |
| Bindings | Keep Handlebars names; new fields only via NOTES “requested additions” |
| Tone | User documentation — not legal advice |
| PII | No real tenant data in the template files |

## How to preview

1. Prefer a local static server from this folder (avoids `file://` fetch issues):

```bash
cd docs/report-pdf-designer
npx --yes serve -p 5173
```

2. Open `http://localhost:5173/preview.html`

3. Or open `preview.html` directly; if sample data fails to load, the page embeds a fallback copy of the sample.

4. Use browser Print → PDF to sanity-check pagination.

## Deliverable checklist (what you return)

- [ ] `template_v4.html`
- [ ] `template_v4.css`
- [ ] `assets/` (+ licenses)
- [ ] `fonts/` (+ embed license confirmation)
- [ ] `preview/` (optional page exports)
- [ ] `NOTES.md` (tokens used, empty-field rules, deviations from BRAND_AND_UX)

## Related files for engineering (FYI only)

- Live HTML renderer: `functions/src/pdf/renderHtmlReportPdf.ts` (`template_v4`)
- Context assembly: `functions/src/pdf/renderReportPdf.ts`
- Packaged files: `functions/templates/template_v4.{html,css}`
