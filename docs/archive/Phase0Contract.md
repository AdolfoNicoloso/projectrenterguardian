# Phase 0 contract — Strapi + Firebase transition

**Status:** agreed and locked.  
**Scope:** decisions required before Phase 1 (Strapi production-ready) and Phase 2 (Functions Strapi-only, Directus removal).  
**Related:** [TransitionToStrapiImplementationPlan.md](./TransitionToStrapiImplementationPlan.md), [STRAPI_MIGRATION.md](./STRAPI_MIGRATION.md).

---

## Parties and ownership

| Role | Decision |
|------|----------|
| **Product / engineering** | Solo; you own all decisions below. |
| **Strapi deploy and uptime** | You own Strapi Cloud projects (staging + prod) and related GitHub repos. |
| **Firebase Functions and Secret Manager** | You own GCP/Firebase project(s) and secret rotation. |

---

## A — Hosting and environments

| ID | Decision |
|----|----------|
| **A.1** | **Strapi Cloud** for hosting (not self-managed VM/Cloud Run for v1). |
| **A.1b** | **Dedicated GitHub repository** for Strapi only, with `package.json` at **repo root** (same application as today’s `strapi/` folder in the monorepo). **Do not** rely on importing the full Expo monorepo into Strapi Cloud. |
| **A.2** | **You** own Strapi deploys and uptime. |
| **A.3** | **United States** region for Strapi and its database (as offered by Strapi Cloud). |
| **A.4** | **Two environments:** **staging** and **production** (two Strapi Cloud apps or equivalent). |
| **A.5** | **Platform default HTTPS hostnames** for both staging and prod for now. **Custom domains** may be added later by changing only **`STRAPI_URL`** (and DNS); the Expo app does not call Strapi directly. |
| **A.6** | **Solo Strapi admin access** (you only). Use **strong passwords** and **2FA** where Strapi Cloud / Strapi admin supports it. IP allowlists deferred until needed. |

---

## B — Media, URLs, and file policy

| ID | Decision |
|----|----------|
| **B.7** | **Firebase Storage** holds **file bytes**. **Strapi** holds **metadata** (and relations) for photos and other upload-backed entities. **Not** “all blobs inside Strapi upload” for v1. |
| **B.8** | **Cloud Functions** mint **short-lived signed** **upload** and **download** URLs for Storage, after **Firebase ID token verification** and **Strapi-backed ownership** checks. The app uses those URLs until expiry, then refreshes via normal list/detail flows or a dedicated refresh path. **Default:** avoid streaming all image bytes through Functions. |
| **B.9** | **Still images only** for v1; **no video**. **Maximum upload size: 20 MB** per file (enforce at URL minting and/or validation). **HEIC** is allowed as **input on the client**; **canonical stored format** should be **JPEG or WebP** via **client-side conversion** (e.g. existing `heic2any` path) plus optional downscale (e.g. long edge **4096 px**, sensible JPEG quality). **Backend:** validate MIME/size (and optional dimension caps); **no mandatory** server-side Sharp/transcode pipeline for MVP (may be added later as a safety net). |

---

## C — Data migration

| ID | Decision |
|----|----------|
| **B.10 / C.11** | **Greenfield:** **no** Directus **files** or **CMS rows** to migrate. No one-time bulk import from Directus is in scope. |
| **C.12** | N/A (no migration tooling required for legacy Directus). |
| **C.13** | When Functions are ready, cutover is still **staged by environment** (staging Strapi + staging secrets first, then prod), even though there is **no legacy data** to port. |

---

## D — Security and secrets

| ID | Decision |
|----|----------|
| **D.14** | **Only Cloud Functions** invoke Strapi REST using the **server API token**. The **Expo app never** stores or sends the Strapi token. |
| **D.15** | **One Strapi API token per environment** (staging vs production), stored in **Google Secret Manager** (or emulator env for local Functions). **Manual rotation** until a process is defined. |
| **D.16** | **MVP Function secrets for Strapi:** **`STRAPI_URL`** and **`STRAPI_API_TOKEN`** per environment. **Firebase Storage** signing uses the **default Functions runtime service account** (no extra service-account JSON in Secret Manager) unless a future requirement forces otherwise. |

---

## E — Firebase / GCP alignment

| ID | Decision |
|----|----------|
| **E.17** | **Same GCP project** as the existing Firebase app for Cloud Functions and Secret Manager (simplest IAM and billing). |
| **E.18** | After cutover, **remove Directus secrets** and **all Directus code paths**; verify **no scripts, dashboards, or users** still depend on Directus. |

---

## F — Timeline and out-of-scope (v1)

| ID | Decision |
|----|----------|
| **F.19** | No fixed calendar date in this contract. **Order of operations:** Strapi staging+prod live → integrate Functions against staging → remove Directus → promote prod secrets. |
| **F.20** | **Explicitly out of scope for v1:** video uploads; server-side image transcoding pipeline (optional later); Strapi **custom domains** until you choose to add them; **any** Directus data migration. |

---

## Contract change process

Amend this file with a dated **“Amendment”** subsection (what changed, why) so Phase 1/2 work stays traceable. Do not silently contradict this contract in other docs—update them or link here.

---

*End of Phase 0 contract.*
