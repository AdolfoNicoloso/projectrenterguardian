# Brand & UX guidelines (report PDF)

Canonical product tokens for Renter Guardian. Use these before inventing a parallel system. Commercial polish is welcome; document any intentional hex/type deviations in your `NOTES.md`.

Sources: app design guide + `src/theme/colors.ts`, `fonts.ts`, `typography.ts`, `spacing.ts`.

---

## Brand base palette

| Token | Hex | Role |
|-------|-----|------|
| primary | `#6F00FF` | Brand / accents (sparing on print) |
| dark | `#191414` | Primary text |
| light | `#FFFFFF` | Page background (print default) |
| gray.50 | `#F9F9F9` | Lightest surface |
| gray.100 | `#F0F0F0` | Light surface |
| gray.200 | `#E0E0E0` | Borders, dividers |
| gray.300 | `#C0C0C0` | Stronger borders |
| gray.400 | `#808080` | Placeholder / muted |
| gray.500 | `#606060` | Tertiary text |
| gray.600 | `#404040` | Secondary / body emphasis |
| gray.700 | `#303030` | Dark text |
| gray.800 | `#202020` | Very dark text |
| gray.900 | `#101010` | Darkest text |
| error | `#FF3B30` | Errors only |
| success | `#34C759` | Success only |
| warning | `#FF9500` | Caution / truncation |
| info | `#007AFF` | Info only |

---

## Light theme (print PDF default)

Use this for the report unless you propose a dark print variant in NOTES.

| Token | Hex | Role |
|-------|-----|------|
| background | `#FFFFFF` | Page |
| backgroundSecondary | `#F9F9F9` | Subtle bands / summary chips |
| backgroundTertiary | `#F0F0F0` | Alt rows |
| text | `#191414` | Headings, body |
| textSecondary | `#404040` | Labels, meta |
| textTertiary | `#606060` | Captions, footer |
| textInverse | `#FFFFFF` | Text on primary fills |
| border | `#E0E0E0` | Rules |
| borderSecondary | `#C0C0C0` | Stronger rules |
| primary | `#6F00FF` | Accent bar, logo mark |
| primaryLight | `#9D4EDD` | Soft accent |
| primaryDark | `#5A00CC` | Darker accent |
| onPrimary | `#FFFFFF` | On purple |
| card | `#FFFFFF` | Surfaces |
| cardSecondary | `#F9F9F9` | Nested surfaces |

---

## Dark theme (brand continuity only)

Documented so print work stays recognizable with the app. **Do not default the PDF to dark.**

| Token | Hex |
|-------|-----|
| background | `#191414` |
| backgroundSecondary | `#221C1C` |
| backgroundTertiary | `#2C2525` |
| text | `#F4F2F2` |
| textSecondary | `#A39C9C` |
| textTertiary | `#7A7373` |
| border | `#3A3333` |
| borderSecondary | `#4A4242` |
| primary | `#9B6DFF` |
| primaryLight | `#B794FF` |
| primaryDark | `#7A3DFF` |
| error | `#FF6B63` |
| success | `#3DDC6A` |
| warning | `#FFB340` |
| info | `#5AA9FF` |
| card | `#241E1E` |
| cardSecondary | `#2C2525` |

---

## Typography

**Family:** Open Sans (weights 400 regular, 600 semibold, 700 bold). Google Fonts for web preview:

`https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap`

If you substitute a licensed commercial font for print embedding, list it in NOTES and keep a similar humanist sans feel.

### Scale

| Token | Size | Typical use |
|-------|------|-------------|
| xs | 12px | Captions, footer |
| sm | 14px | Meta labels, comparison notes |
| base | 16px | Body |
| lg | 18px | Space names |
| xl | 20px | Section titles |
| 2xl | 24px | Report title (compact) |
| 3xl | 30px | Report title (hero) |
| 4xl | 36px | Rare; cover only if justified |

### Weights & line height

- regular 400 — body  
- medium 500 / semibold 600 — labels, section titles  
- bold 700 — main title  
- Line height: tight 1.2 (headings), normal 1.5 (body), relaxed 1.75 (long disclaimer)

### Report hierarchy (recommended)

1. Page title — 2xl–3xl, bold, text  
2. Section — xl–2xl, semibold  
3. Space name — lg, semibold  
4. Body / notes — base or sm, regular  
5. Meta (type, generated, counts) — sm, textSecondary  
6. Captions / footer — xs, textTertiary  

---

## Spacing

4px scale:

| Token | px |
|-------|-----|
| xs | 4 |
| sm | 8 |
| md | 16 |
| lg | 24 |
| xl | 32 |
| 2xl | 48 |
| 3xl | 64 |

- Between sections: **lg (24)**  
- Screen-like content padding feel: **md–lg (16–24)** inside ≥ **0.5 in** print margins  
- Photo grid gutters: **sm–md (8–16)**  

### Radius (app UI reference)

Buttons/inputs 8px, cards/badges 12px. For PDF, prefer thin rules and light bands over heavy card chrome / multi-layer shadows.

---

## Color usage (product rules)

1. **Primary `#6F00FF`:** accents, active marks, logo — not large ink-heavy fills.  
2. **Gray scale:** surfaces 50–100, borders 200–300, secondary text 400–600, headings 700–dark.  
3. **Semantic colors:** sparingly — error only for real errors; warning for truncation/caution; success/info rare in print.  

---

## PDF-specific UX rules

1. Default **light / print** palette (white paper, dark text).  
2. Truncation / caution copy → **warning** (`#FF9500`), not error red.  
3. Disclaimer → secondary text, clear separation; never compete with the title.  
4. Photo grids → consistent gutters; captions xs gray; no labels over images.  
5. Empty optional fields → **hide the block** (preferred) vs “N/A” spam.  
6. Keep purple + charcoal + gray recognizable; list new accents in NOTES.  
7. Footer on every page: template version + “User documentation — not legal advice”.  
8. Avoid clutter: one job per section; no dashboard-style stat strips competing with photos.  

---

## CSS variables (starter)

Match `template_v4.css`:

```css
:root {
  --color-primary: #6F00FF;
  --color-primary-light: #9D4EDD;
  --color-primary-dark: #5A00CC;
  --color-text: #191414;
  --color-text-secondary: #404040;
  --color-text-tertiary: #606060;
  --color-bg: #FFFFFF;
  --color-bg-secondary: #F9F9F9;
  --color-border: #E0E0E0;
  --color-warning: #FF9500;
  --font-sans: "Open Sans", system-ui, sans-serif;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
}
```
