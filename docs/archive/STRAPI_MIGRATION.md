# Strapi migration (MVP backend)

This document tracks moving the backend from **Directus** (called via **Firebase Cloud Functions**) to **Strapi 5**, while keeping **Firebase Auth** and (initially) the **same HTTP function names** expected by the Expo app (`backendClient`).

## What exists now

| Location | Purpose |
|----------|---------|
| `strapi/` | Strapi **5.43** app (SQLite locally; switch to Postgres for production). |
| `strapi/src/api/*` | Content-types aligned with `src/types/index.ts` and `functions/src/index.ts` behavior. |
| `functions/src/index.ts` | All **Directus** calls today; to be rewired to Strapi REST or Entity Service. |
| Expo `src/services/*Service.ts` | Call Firebase Functions only—**no app change** until Functions return the same JSON shapes. |

## Content-types (Strapi)

| Strapi UID | Maps from |
|------------|-----------|
| `api::app-profile.app-profile` | `app_profiles` + `firebase_uid` |
| `api::property.property` | `properties` |
| `api::space.space` | `spaces` |
| `api::photo.photo` | `photos` (media field `file`) |
| `api::photo-assignment.photo-assignment` | `photo_space_assignments` |
| `api::report.report` | `reports` |
| `api::inspection.inspection` | `inspections` |
| `api::inspection-step.inspection-step` | `inspection_steps` |
| `api::user-preference.user-preference` | `user_preferences` |

**Not modeled yet (add when needed):** `disclaimer_blocks`, `jurisdiction_context` (CMS-style static content)—use Strapi single types or a small `static-block` collection later.

## Firebase secrets (Strapi mode)

Create secrets (names must match exactly):

- `STRAPI_URL` — e.g. `https://your-project.strapi.app` (no trailing slash)
- `STRAPI_API_TOKEN` — **Full access** API token from Strapi admin (**Settings → API Tokens**)

Until both are set in the environment the function sees, the app keeps using **Directus** for all endpoints (including the three Strapi-ready ones above).

**Caution:** If you turn Strapi on (`STRAPI_URL` + token set) but leave other functions on Directus, the mobile app will break as soon as it hits an unported endpoint (spaces, photos, etc.). Use Strapi mode only for **targeted testing** of profile + property list/detail until more routes are ported—or finish porting the rest before enabling secrets in production.

**Emulator:** set `STRAPI_URL` and `STRAPI_API_TOKEN` in the shell or use `functions/.env.example` as a reference (load with your own dotenv / `firebase emulators:start` setup).

## Local development

```bash
cd strapi
npm install   # if needed
npm run develop
```

First run: create the Strapi admin user, then **Settings → Users & Permissions → Roles → Public / Authenticated** and enable the REST actions you need for testing. For production, the app should **not** use Public; use **Firebase Functions + Strapi API token** or custom Strapi auth with Firebase ID tokens.

**Build admin only (CI):**

```bash
cd strapi && npm run build
```

## API response shape vs Expo app

Strapi 5 REST returns **`data` + `meta`** with **camelCase** attributes and **documentId** (and numeric `id` in DB layer). Your app and Functions today expect **snake_case** and string IDs matching Directus.

**Rule:** Keep **Firebase Functions** as the compatibility layer: Functions call Strapi, then **map** responses to the existing `{ data: … }` shapes used in `propertiesService`, `photosService`, etc.

## Implementation phases (backend)

1. **Done:** Strapi scaffold + content-types + `npm run build` green.  
2. **Done (opt-in):** When **`STRAPI_URL`** and **`STRAPI_API_TOKEN`** are both set, HTTPS functions route CMS reads/writes through **`functions/src/strapi/`** (barrel `strapi/index.ts`): profiles, properties, spaces, photos, uploads, inspections, reports, assignments, user preferences, file proxy, `smokeTest`, and related endpoints. Responses stay Directus-shaped for the app. **`secrets: CMS_SECRETS`** includes Strapi secrets alongside Directus.
3. **Staging:** Point a branch’s Functions env at Strapi (Cloud URL or self-hosted) and run critical flows.
4. **Remove:** Directus secrets and `directusRequest` once parity tests pass.

## Firebase Functions → Strapi endpoint cheat sheet

Each function keeps its URL; internally use Strapi REST, e.g.:

- `GET /api/app-profiles?filters[firebase_uid][$eq]=...`  
- `GET /api/properties?filters[app_profile][id][$eq]=...` (or `documentId` depending on Strapi filter docs)  
- `POST /api/properties` with `data: { app_profile: connectId, ... }`

Use Strapi’s [REST filter docs](https://docs.strapi.io/dev-docs/api/rest/filters-locale-publication) for `documentId` vs `id` in your Strapi version.

## Deploy targets

- **Strapi Cloud:** Connect repo / deploy from Strapi dashboard; set production DB if required by plan.  
- **Self-host:** Node 20+, Postgres, `NODE_ENV=production`, `npm run build && npm run start`, env for database and `APP_KEYS`, `API_TOKEN_SALT`, etc. (see Strapi deployment docs).

## Related files

- `strapi/README.md` — short project readme.  
- `functions/src/index.ts` — porting surface area.  
- `src/types/index.ts` — target field names for response mapping.
