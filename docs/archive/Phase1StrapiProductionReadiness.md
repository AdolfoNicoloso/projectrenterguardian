# Phase 1 — Strapi production readiness

**Prerequisite:** [Phase0Contract.md](./Phase0Contract.md) is locked.  
**Goal:** Strapi **staging** and **production** are live on **Strapi Cloud (US)**, on **Postgres**, with **build + admin** working; REST is smoke-tested; **API tokens** exist for later Function wiring.

Phase 1 does **not** require removing Directus from Functions yet (that is Phase 2).

---

## 1. Dedicated Strapi Git repository

- Create a **new empty GitHub repo** (e.g. `projectrenterguardian-strapi`), **public or private** as you prefer.
- Copy **only** the contents of this monorepo’s `**strapi/`** directory into the **root** of the new repo (so `package.json` is at the root, not under `strapi/`).
- **Do not** commit `.tmp/`, `.env`, or local SQLite DB files; keep `.gitignore` from the Strapi app.
- Push `main` (or your default branch) to GitHub.
- Optional: add a one-line note in the **monorepo** `strapi/README.md` pointing to the canonical deploy repo URL (when created).

**Ongoing sync:** until you fully detach, treat the monorepo `strapi/` as the **source of truth for code edits**, and **copy or subtree-merge** into the deploy repo before Strapi Cloud builds—or flip ownership later so only the standalone repo is edited.

---

## 2. Strapi Cloud — staging (do this first)

- Create a **Strapi Cloud** project in **US** region, linked to the **standalone GitHub repo** and the correct branch.
- Let Strapi Cloud provision **Postgres** (managed). Do not use SQLite in cloud.
- Confirm **deploy succeeds** (build + start green).
- Complete **Strapi admin** first-time setup; enable **2FA** if available.
- In **Settings → API Tokens**, create a **Full access** (or equivalent) token for **server-to-server** use. Store it only in your password manager until Secret Manager is wired in Phase 2.
- Record `**STRAPI_URL`** (platform default HTTPS base, no trailing slash).

---

## 3. Strapi Cloud — production

- Repeat section 2 for a **second** Strapi Cloud project (**production**).
- Use a **separate** API token and URL from staging. Never reuse staging tokens in prod.

---

## 4. Database and environment (reference)

This repo’s `strapi/config/database.ts` supports `**DATABASE_CLIENT=postgres`** and `DATABASE_URL` (or discrete `DATABASE_*` vars). **Strapi Cloud** typically injects database settings for you—verify in their dashboard/docs that you do not need to hand-edit `config/database.ts` for cloud.

Local development may keep **SQLite**; production/staging use **Postgres** only.

---

## 5. Content-types and build sanity

- After first cloud deploy, open **admin → Content Manager** and confirm collections exist per [STRAPI_MIGRATION.md](./STRAPI_MIGRATION.md).
- From a machine with `curl` (or Strapi’s REST doc UI), **GET** with the API token:
  - `/api/app-profiles?pagination[pageSize]=1`
  - Repeat spot-checks for other UIDs as needed (`property`, `photo`, etc.).
- Confirm `**npm run build`** passes locally in the standalone repo (same as CI expectation).

---

## 6. Permissions posture (MVP)

- **Do not** expose Strapi REST to the public internet with a token in the mobile app.
- Tighten **Public** role in Strapi so anonymous users cannot read/write private collections (Functions will use the **API token**).
- Document in your runbook: **who rotates tokens** and **where** staging vs prod URLs live (Secret Manager names TBD in Phase 2).

---

## 7. Firebase Storage (prep for Phase 2)

Phase 1 can be Strapi-only. Optionally in parallel:

- Confirm **Firebase Storage** is enabled in the Firebase console.
- Decide default **Storage bucket** and path convention for photo objects (e.g. `photos/{appProfileId}/{photoId}.jpg`)—document in Phase 2 task list.

---

## 8. Exit criteria for Phase 1

Phase 1 is **done** when:

1. **Staging** Strapi URL + admin + API token work; REST smoke tests pass.
2. **Production** Strapi URL + admin + API token work (can be empty data).
3. **Standalone GitHub repo** is the source Strapi Cloud builds from.
4. You have **written down** (password manager or internal doc) **staging vs prod** `STRAPI_URL` and token **names/placement** for Phase 2 Secret Manager wiring.

---

## Next: Phase 2

See [TransitionToStrapiImplementationPlan.md](./TransitionToStrapiImplementationPlan.md) §5 — remove Directus branches from Functions, implement **Storage signed URLs** + Strapi metadata per Phase 0, bind secrets, deploy.