# Current architecture — Project Renter Guardian

**Stack:** Expo (React Native) → Firebase Auth + Cloud Functions → Cloud Firestore + Cloud Storage.

The mobile/web app never talks to Firestore or Storage directly.

## Request path

1. User signs in with Firebase Auth (email/password or Google).
2. Client calls HTTPS Cloud Functions with `Authorization: Bearer <Firebase ID token>`.
3. Function verifies the token, resolves/creates `app_profiles/{id}` by `firebase_uid`.
4. Function enforces ownership (`app_profile_id`) and reads/writes Firestore.
5. Photo bytes go to GCS bucket `project-renter-guardian-media` via `uploadFile` / `getFile`.

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
