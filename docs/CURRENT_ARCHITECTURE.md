# Current architecture — Project Renter Guardian

**Stack:** Expo (React Native) → Firebase Auth + Cloud Functions → Cloud Firestore + Cloud Storage.

The mobile/web app never talks to Firestore or Storage directly.

## Request path

1. User signs in with Firebase Auth (email/password or Google).
2. Client calls HTTPS Cloud Functions with `Authorization: Bearer <Firebase ID token>`.
3. Function verifies the token, resolves/creates `app_profiles/{id}` by `firebase_uid`.
4. Function enforces **property access** (owner or active collaborator: `view` / `edit`) and reads/writes Firestore.
5. Photo bytes live in GCS bucket `project-renter-guardian-media`.

## Media pipeline

```
Camera / library
  → processImageForUpload (HEIC→JPEG on web if needed; max ~2048px edge)
  → createMediaUpload (pending media_files + GCS resumable upload URL)
  → client PUT bytes directly to GCS
  → finalizeMediaUpload (marks ready; generates thumb ~400px + display ~1600px with sharp)
  → createPhoto (Firestore photo row with opaque file id)

Display:
  → getFile?fileId=&token=&variant=thumb|display|original
  → ACL check, then 302 to a short-lived V4 signed GCS GET URL when signing works
     (falls back to proxying bytes through the Function if signing is unavailable)
  → grids use thumb; lightbox / detail use display
```

Public share preview can also mint `thumb_url` / `display_url` in `getPublicPropertyPreview`. Gallery lists may pass `fields=gallery` for a lean DTO (no notes).

Base64 `uploadFile` still exists for small/legacy uploads (~15MB cap). Prefer direct upload.

## Where things live

| Concern | Start here |
|---------|------------|
| Routes (Expo Router) | `app/` |
| Shared UI (`PRG*`) | `src/components/` |
| Property dashboard panels + hub | `src/screens/` (e.g. Spaces / Photos tabs; `PropertyHubHome` for Rents/Tours) |
| Domain API clients | `src/services/*Service.ts` → `backendClient` |
| Auth / properties / notifications state | `src/state/` |
| Media URL builder (auth + cache + concurrency) | `src/utils/fileUrl.ts` |
| HTTPS handlers | `functions/src/http/` |
| Firestore / Storage domain logic | `functions/src/firestore/` |
| Invites & members | `functions/src/firestore/sharing.ts`, `src/services/propertyMembersService.ts` |
| Public no-login share | `functions/src/firestore/publicShares.ts`, `app/share/[token].tsx` |

**Tabs:** authenticated home is **Rents** / **Tours** (`app/(tabs)/rents`, `tours`) wrapping `PropertyHubHome`. Property create/detail still live under `app/(tabs)/properties/`.

### Large flow modules (split for readability)

| Flow | Orchestrator | Pieces |
|------|--------------|--------|
| Inspection wizard | `app/(tabs)/inspections/[id].tsx` | `src/screens/inspection/*Step.tsx`, `wizardSteps.ts`, `wizardStyles.ts`, guided-walk phases |
| Rents / Tours hub | `src/screens/PropertyHubHome.tsx` | `src/screens/propertyHub/` (cards, lists, filters, prompts, styles) |
| Property spaces tab | `src/screens/PropertySpaces.tsx` | `src/screens/propertySpaces/` (thumbs, reorder helpers, styles) |
| Sharing backend | `functions/src/firestore/sharing.ts` (barrel) | `sharingNormalize`, `sharingInternal`, `sharingInvites`, `sharingMembers` |

### Property lifecycle milestones

Tour pipeline uses soft fields on `properties` (not new status values): `tour_completed_at` / `tour_completed_source`, `move_in_baseline_inspection_id`, `next_check_in_at` / `check_in_reminder_opt_in`. Hub stage badges come from `getToursHubStage`. Check-in reminders run with the tour-reminder scheduler via `processDueCheckInReminders`.

## Repo layout

| Path | Role |
|------|------|
| `app/` | Expo Router screens (thin: UI + service calls) |
| `src/components/` | Shared PRG* UI |
| `src/screens/` | Property dashboard panels used by `app/(tabs)/properties/[id].tsx` |
| `src/services/` | Domain services → `backendClient` |
| `src/state/authStore.ts` | Auth session (Zustand) |
| `functions/src/http/` | HTTPS handlers |
| `functions/src/firestore/` | Firestore/Storage domain logic |
| `docs/archive/` | Historical Directus/Strapi docs (not current) |

## Local app env (root `.env`)

Required: `EXPO_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID` (plus storage bucket / messaging / measurement as in Firebase web config).

No Directus or Strapi env vars.

## Coding rules

See [CODINGRULES.md](./CODINGRULES.md).

## API surface

Function names match client `backendClient.call(...)` targets (`getMyProperties`, `uploadFile`, `bootstrapProfile`, …). Region: `us-central1`.

### Notifications & property invites

- Invites create `notifications` docs for matching existing profiles; they are **not** auto-accepted on login.
- Client inbox: `listMyNotifications`, `markNotificationRead` (also `{ all: true }`).
- UI: bell + unread badge, top invite banner, `/(tabs)/notifications` inbox. Accepting an invite refreshes the property list without forcing navigation into the property.
