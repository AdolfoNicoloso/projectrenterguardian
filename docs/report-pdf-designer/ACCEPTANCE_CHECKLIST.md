# Acceptance checklist — designer zip

Use when reviewing `renter-guardian-report-template-v2/` before handing to engineering.

## Package

- [ ] Zip / folder named `renter-guardian-report-template-v2/`
- [ ] `template_v4.html` present
- [ ] `template_v4.css` present
- [ ] `assets/` present (or documented N/A)
- [ ] `fonts/` present with license note for embedding
- [ ] `NOTES.md` present
- [ ] Optional `preview/` page exports

## Bindings

- [ ] Handlebars names match DATA_DICTIONARY (no silent renames)
- [ ] New fields listed under “requested additions” in NOTES
- [ ] Optional blocks hide when empty (or NOTES documents alternate)

## Brand & layout

- [ ] Follows BRAND_AND_UX (purple / charcoal / gray recognizable)
- [ ] Deviations listed in NOTES with hexes
- [ ] US Letter, margins ≥ 0.5 in
- [ ] Structure: cover → summary → spaces → disclaimer → footer
- [ ] Truncation warning uses warning color, not error red
- [ ] No “court-ready” / certified-inspection language
- [ ] Footer includes user-documentation / not-legal-advice line

## Preview QA

- [ ] Opens with sample-data (or preview.html equivalent)
- [ ] 0-photo space does not break layout
- [ ] Many photos paginate cleanly
- [ ] Print to PDF smoke test looks acceptable

## Engineering handoff

- [ ] Fonts are licensed for PDF embed
- [ ] Asset licenses clear
- [ ] Ready to map `photos[].src` ← server JPEG buffers
