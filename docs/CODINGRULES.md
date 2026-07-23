# Coding rules — Project Renter Guardian (PRG)

Non-negotiable rules for modifying this codebase.

## 0) Prime directive

- Do not break existing behavior unless fixing a clear bug.
- Prefer small, incremental changes.
- Keep architecture consistent with [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md).
- When in doubt, match neighboring files.

## 1) Where things go

### Routes (`app/`)
- Expo Router screens only: UI, input, calling services, navigation, loading/error.
- No multi-step backend orchestration inside route files.

### UI (`src/components/`)
- Shared presentational components (`PRG*` prefix where applicable).
- No direct backend calls.

### Screens (`src/screens/`)
- Composite panels for the property dashboard (Overview / Spaces / Photos / Report).
- Most other flows live under `app/` routes.

### Services (`src/services/`)
- Domain wrappers that call `backendClient` only.
- Never import Firestore/Storage SDKs or call CMS APIs from the client.

### Cloud Functions (`functions/src/`)
- `http/` — HTTPS handlers (auth, CORS, status codes).
- `firestore/` — ownership checks, CRUD, Storage uploads.
- Keep response shapes (`{ data: … }` snake_case) stable for the Expo app.

## 2) Backend contract

```
Client → Firebase Cloud Functions (Bearer ID token)
       → Firestore (metadata) + Storage (photo bytes)
```

- Ownership is always enforced server-side via `app_profile_id` / `firebase_uid`.
- Do not add Directus or Strapi dependencies to the live path.
- Do not put Strapi/Directus tokens in the Expo app.

## 3) Comments

- Module header: what the file owns (2–6 lines).
- Comment why / ownership / side effects — not TypeScript types.
- Prefer updating [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md) over long inline essays.

## 4) Docs

- Current truth: README + `docs/CURRENT_ARCHITECTURE.md` + this file.
- Historical material lives under `docs/archive/` — do not treat it as setup instructions.

## 5) Safety

- Do not rename Cloud Function export names without updating every client caller.
- Do not weaken Firestore/Storage security (client access stays denied; Admin SDK only).
- Do not commit `.env`, API tokens, or service-account JSON.
