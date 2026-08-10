# Report PDF templates (production)

Canonical template for `generateReportPdf`:

| File | Role |
|------|------|
| `template_v4.html` | Handlebars markup |
| `template_v4.css` | Print-first US Letter styles |
| `assets/` | Logo |
| `fonts/` | Open Sans (embeddable) |

Loaded by `functions/src/pdf/renderHtmlReportPdf.ts`. Keep designer docs in sync under `docs/report-pdf-designer/template_v4.*`.

Prior: `template_v3.*` retained for reference; not used by the renderer.

## How to Update Report Template

1. Edit `template_v4.html` / `template_v4.css` (and sync the copies under `docs/report-pdf-designer/`).
2. From `functions/`: `npm run build` — confirm `lib/pdf/renderHtmlReportPdf.js` points at the files you intend (Cloud runs emitted `lib/`, not `src/`).
3. Deploy with the CLI (MCP/console deploys can report success without shipping a new revision):

```bash
npx firebase deploy --only functions:generateReportPdf --project project-renter-guardian
```

4. Regenerate a PDF in the app; do not reopen an old download.
