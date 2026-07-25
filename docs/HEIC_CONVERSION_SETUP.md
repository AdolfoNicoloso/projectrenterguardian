# HEIC handling

## Current behavior (authoritative)

HEIC/HEIF is converted on the **client** before upload—not on Cloud Functions and not to Directus.

1. On web, [`src/services/photoUploadService.ts`](../src/services/photoUploadService.ts) detects HEIC (MIME, extension, or file signature) and loads `heic2any` only when needed.
2. Native pickers typically return a JPEG-compatible representation when using Compatible mode.
3. The server **rejects** HEIC uploads on the base64 `uploadFile` path; upload JPEG (or another non-HEIC image type).
4. `sharp` in Functions is used to generate **thumb** / **display** variants after upload—not for HEIC conversion.

See [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md) for the full media pipeline.

## Troubleshooting

- If HEIC fails on web: ensure `heic2any` is installed and the page can load it; refresh and retry.
- Prefer converting on-device or using Compatible picker representation so the upload path never sees HEIC.

## Historical note

Older notes that describe server-side HEIC→JPEG via `sharp` into Directus are obsolete. Those docs belong under `docs/archive/` if retained for history.
