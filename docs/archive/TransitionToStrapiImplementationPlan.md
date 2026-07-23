# Transition to Strapi — Implementation Plan

This document is the implementation plan for fully adopting **Strapi** as the CMS behind **Firebase Cloud Functions**, and **removing Directus** (secrets, code paths, docs, and workflows). The app stays **Expo / React Native (React 18)** and talks only to **Firebase** (Auth + Functions); Functions talk to **Strapi**.

For content-type mapping and secret names, see [STRAPI_MIGRATION.md](./STRAPI_MIGRATION.md).

---

## 1. How the pieces fit (target state)

| Layer | Responsibility |
|--------|------------------|
| **Expo / React Native (React 18)** | UI only. Calls **Firebase Cloud Functions** over HTTPS with the **Firebase ID token**. Does **not** call Strapi or Directus directly. |
| **Firebase Auth** | Identity; Functions verify the token and map the user to an **app profile** in Strapi (`firebase_uid`). |
| **Firebase Cloud Functions (Node)** | Sole **API + authorization + response shaping** layer. Uses a **Strapi API token** (Secret Manager) to call **Strapi 5 REST**. Returns the **same JSON shapes** the app expects today (snake_case / Directus-shaped payloads) so client changes stay minimal. |
| **Strapi 5** | Source of truth for structured content: profiles, properties, spaces, photos metadata, inspections, reports, assignments, user preferences. **Postgres** in production (not SQLite). |
| **Media** | **Firebase Storage** for file bytes; **Strapi** for metadata and relations. **Cloud Functions** mint short-lived signed URLs. Locked in [Phase0Contract.md](./Phase0Contract.md). |

**No Directus:** no secrets, no HTTP calls from Functions, no Directus upload/asset URLs, no env vars or docs referencing Directus.

**Why this matches Strapi vs Directus:** Both are headless CMSs with REST. The app never depended on a Directus SDK in `functions/package.json`; it was always HTTP from Functions. Strapi replaces Directus with its own REST and document model; Functions remain the **compatibility façade** so React does not need to internalize Strapi’s `data` / `documentId` / camelCase responses.

---

## 2. Current gap (honest assessment)

- **`functions/src/index.ts`** still contains **`directusRequest`** and many **`else` branches** when Strapi credentials are absent, plus **Directus file upload** (`/files`) and **asset** logic tied to Directus URLs/tokens.
- **Secrets:** `DIRECTUS_URL` / `DIRECTUS_SERVICE_TOKEN` remain in the Functions secret bundle (`CMS_SECRETS` or equivalent).
- **App:** Small leftovers — e.g. **`src/services/storage.ts`** AsyncStorage key names (`directus_token` / `directus_user`), **`src/types`** comments/field names, **`scripts/verify-setup.js`**, and **README / docs** still describing Directus.

---

## 3. Phase 0 — Decisions (before large deletes)

**Locked decisions** are recorded in **[Phase0Contract.md](./Phase0Contract.md)** (hosting, environments, media, URLs, migration, security, GCP alignment).

Summary: **Strapi Cloud (US), staging + prod, default hostnames**; **standalone Strapi GitHub repo**; **Firebase Storage + Strapi metadata**; **signed URLs from Functions**; **greenfield** (no Directus migration); **Functions-only** Strapi token in **Secret Manager**.

---

## 4. Phase 1 — Strapi production-ready

**Checklist:** [Phase1StrapiProductionReadiness.md](./Phase1StrapiProductionReadiness.md).

- Deploy Strapi with **Postgres**; align **`strapi/`** content-types with what Functions and types expect (see STRAPI_MIGRATION table).
- **Permissions:** Prefer **no** public Strapi REST for sensitive types; **only Functions** call Strapi with the API token for MVP.
- **Build / run:** `strapi build` in CI; production `strapi start` (or platform equivalent).
- Validate Strapi standalone: REST for each collection used under **`functions/src/strapi/`**.

---

## 5. Phase 2 — Functions: Strapi-only, feature-complete

Work **per HTTP function** or **per domain** (properties, spaces, photos, uploads, inspections, reports, assignments, `getFile`, etc.):

- Remove branches that call **`directusRequest`** when Strapi is not configured.
- **Require** Strapi: if `STRAPI_URL` / token missing → **503** with a clear, stable error body (reuse patterns like `respondCmsNotConfigured`).
- Ensure every former Directus path has a **`functions/src/strapi/`** implementation; extend modules as needed.
- **Upload, file metadata, `getFile`:** Implement end-to-end on the chosen media strategy (Phase 0); remove all **`fetch(…/files)`**, **`…/assets/`**, and file-related **`directusRequest`** usage.
- Delete **`directusRequest`**, Directus-only types/helpers, **`defineSecret("DIRECTUS_*")`**, and remove Directus from shared secret arrays bound to functions.
- **Redeploy** all functions; **delete** Directus secrets from **Google Secret Manager** after nothing references them.

---

## 6. Phase 3 — Firebase and operations

- Secret Manager holds only **`STRAPI_URL`**, **`STRAPI_API_TOKEN`**, and any additional secrets you add (e.g. storage keys if applicable).
- Confirm the Cloud Functions service account can read those secrets (existing model).
- **Observability:** log Strapi failures with HTTP status and truncated body (never log tokens); optional alert on failures via `smokeTest` or dashboards.

---

## 7. Phase 4 — Expo / React app cleanup

- Remove **`EXPO_PUBLIC_DIRECTUS_URL`** and dead config from **README**, **`.env.example`**, **QUICKSTART**, **`scripts/verify-setup.js`**.
- Optionally rename **AsyncStorage** keys in **`src/services/storage.ts`**; if renamed, consider a one-time read-old / write-new migration for existing installs.
- **`src/types`:** Rename or document **`directus_users_id`** to a neutral name when payloads from Functions are updated to match.

**Note:** No required React / Expo upgrade for the Strapi cutover unless you choose to; versions are orthogonal to CMS replacement.

---

## 8. Phase 5 — Repository hygiene

- Delete or rewrite **Directus-only** docs under `docs/`.
- **README:** single story — Firebase Auth + Functions + Strapi; links only to Strapi deploy and Functions deploy.
- **`strapi/README.md`:** production environment checklist.

---

## 9. Phase 6 — Verification

- **Test matrix:** each major app screen → Functions invoked → Strapi collection → create / read / update / delete paths.
- **Staging:** Functions environment points at staging Strapi; run the matrix; then switch production secrets.
- Keep **`smokeTest`** (or equivalent) as a quick post-deploy check: Firebase token + Strapi reachability + representative read.

---

## 10. Execution order (summary)

1. Host Strapi + Postgres + API token.  
2. Complete every Functions route on Strapi; delete all Directus branches and file logic.  
3. Remove Directus secrets and dead code.  
4. Clean app env, scripts, and type naming.  
5. Purge obsolete docs; one architecture narrative.  
6. Staging matrix → production cutover.

---

## 11. Dependency summary

| Piece | Final MVP role |
|--------|----------------|
| React / RN / Expo | UI; Functions only. |
| Firebase Auth | Identity. |
| Cloud Functions | AuthZ, Strapi client, mapping, optional file proxy. |
| Strapi 5 | CMS + entities in Postgres. |
| Directus | **Removed** — no SDK required today in `functions/package.json`; removal is **code + secrets + docs + media paths**. |

---

*Document generated to capture the agreed transition plan. Update phases with dates, owners, and links to PRs as work proceeds.*
