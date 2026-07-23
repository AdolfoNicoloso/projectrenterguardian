# Project Renter Guardian — MVP Completion Implementation Plan

**Status:** Draft for product/engineering review — **do not implement until approved**  
**Author role:** Senior software engineer / technical lead  
**Date:** 2026-07-17  
**Repo audited:** `/Users/adolfolistanicoloso/Dev/ProjectRenterGuardian`  
**Sources of truth:** Runtime code under `app/`, `src/`, `functions/src/` — not archive docs  

**Compliance references (reputable):**
- [Apple App Review Guidelines §4.8 Login Services](https://developer.apple.com/app-store/review/guidelines/) and account deletion (§5.1.1(v))
- [Google Play account deletion / User Data policy](https://support.google.com/googleplay/android-developer/answer/13327111)
- Firebase Auth popup vs redirect guidance (official Firebase docs)

---

## Executive assessment

### Verdict

The **core documentation loop works** on the server and in-app tabs: Auth → property (+ default spaces) → photos/notes/single assign → guided inspection → report snapshot → list/review. Backend is correctly shaped (Expo → Functions → Firestore + Storage; no live Directus/Strapi).

The product is **not MVP-complete** against the finished journey and store/web launch bar. Launch blockers include: **PDF**, **onboarding inspection placeholder**, **unreachable multi-select/bulk assign**, **password reset**, **Sign in with Apple (required with Google)**, **account deletion (+ web URL)**, **native Google Sign-In**, **camera/photo permission strings**, **Privacy/Terms**, **Insights mislabel**, **space-delete orphan refs**, and **dependency skew vs Expo 51**.

### What “finished MVP” means here

A new renter can complete the full journey on **iOS, Android, mobile Safari/Chrome, desktop browsers, and tablet**, with **no launch-facing placeholder or dead button**, including **PDF download/share**.

---

## A. Repository audit

### Architecture (verified)

| Layer | Reality |
|-------|---------|
| Client | Expo `~51`, RN `0.74`, Expo Router `~3.5`, React 18 |
| Targets | iOS / Android / web (Metro); EAS profiles in `eas.json` |
| Auth | Firebase JS Auth only (`src/services/firebase.ts`, `googleAuth.ts`) |
| API | HTTPS Cloud Functions v2 `us-central1` via `backendClient` |
| Data | Firestore collections via Admin SDK in `functions/src/firestore/` |
| Media | GCS bucket `project-renter-guardian-media`; path `uploads/{appProfileId}/{uuid}_{filename}`; registry `media_files/{id}` |
| Ownership | `app_profiles.firebase_uid` → `app_profile_id` on properties; Functions enforce |
| Client data plane | **No** client Firestore/Storage SDK |

### Routing (`app/`)

- Root stack: welcome, auth, onboarding, tabs  
- Tabs: Properties, Inspections, Insights, Profile  
- Property nested: spaces, photos, assignments/bulk, reports  
- Auth gate on tabs only (`isAuthenticated`); **onboarding not enforced** on tab entry  

### State & forms

- Zustand: `authStore` only  
- Forms: controlled `useState` + `validation.ts`; no form library  
- Domain data: fetch-in-screen + services  

### Cloud Functions (exports)

Profile: `smokeTest`, `bootstrapProfile`, `getAppProfile`, `updateAppProfile`, `getUserPreferences`, `updateUserPreferences`  
Properties: CRUD  
Spaces: CRUD + `propertyHasInspections`  
Photos: CRUD + `uploadFile` + `getFile` + `createAssignment` + `getAssignments`  
Inspections: create/list/get/update + steps  
Reports: create/list/get  

**Missing vs client:** `updateAssignment`, `deleteAssignment` (client calls exist; Functions do not).

### Firestore collections

`app_profiles`, `user_preferences`, `properties`, `spaces`, `photos`, `photo_assignments`, `media_files`, `inspections`, `inspection_steps`, `reports`  

Rules: deny-all client (`firestore.rules`, `storage.rules`).

### UI kit

`PRGButton`, `PRGInput`, `PRGCard`, `PRGBadge`, `PRGTabBar`, `PRGPhotoGrid`, `PRGEmptyState`, `PRGLoadingOverlay`, `PRGToast`, `PRGHeader`, `PRGEditableTextRow`, `ScreenContainer`, `DateField`, `LanguagePicker`, `NumberPicker`, `InspectionCTA_Banner`, toast provider.

### Tests / observability / legal / permissions

| Area | Status |
|------|--------|
| Tests | Only `functions/test/mappers.test.ts`; **no app E2E/unit** |
| Analytics | Not wired (`measurementId` unused) |
| Crash/error monitoring | None (no Sentry/Crashlytics) |
| Privacy/Terms | **Not in Profile UI** |
| Camera/photo plist/manifest | **Missing** in `app.json` despite runtime permission requests |
| Web hosting | No Firebase Hosting; `npm run web` only |
| Env | Root `.env` + `EXPO_PUBLIC_FIREBASE_*`; no root `.env.example` |

### Technical debt interfering with launch

1. Expo 51 vs `react-native-reanimated@4` / `expo-dev-client@6` skew — stabilize with `npx expo install`.  
2. `console.log` of Firebase ID token in `firebase.ts` — remove.  
3. Orphan bulk-assign route; `PRGPhotoGrid` selection unused.  
4. Onboarding resume incomplete (duplicate-property risk).  
5. `lease_term` not in Functions update allowlist.  
6. Legacy naming: `cmsDateTime`, `getAuthenticatedCmsFileUrl`.  
7. Unused onboarding `create-property.tsx` alternate path.  

### Capability verification (claimed features)

| Capability | Classification |
|------------|----------------|
| Email/password auth | Complete |
| Google auth | Incomplete (web popup/redirect; **native throws**) |
| Profile bootstrap | Complete |
| Onboarding (through property create) | Complete with gaps |
| Guided inspection in onboarding | **UI placeholder only** |
| Property CRUD | Complete |
| Default spaces | Complete |
| Custom spaces | Complete |
| Photo capture/upload + HEIC | Complete (progress/retry incomplete) |
| Photo notes | Complete |
| Single assign | Complete |
| Bulk assign / multi-select | Present but **unreachable / incomplete** |
| Guided inspection (tabs) | Complete (resume OK; polish needed) |
| Report snapshots | Complete |
| PDF | **UI placeholder only** |
| Insights | **Different than described** (report list) |
| Theme prefs | Complete |
| Archive property | Partial (`status=archived`; no move-in/out dates) |
| Multiple properties | Complete |
| Password reset | **Not implemented** |
| Account deletion | **Not implemented** |
| Sign in with Apple | **Not implemented** |
| Cancel property create (dirty discard) | **Not implemented** |

---

## B. Gap matrix (MVP blockers highlighted)

| Feature | Status | Platforms | Key modules | FE work | BE work | Data/Storage | Tests | Deps | Risk | Effort | Blocker |
|---------|--------|-----------|-------------|---------|---------|--------------|-------|------|------|--------|---------|
| PDF generate/download/share | Placeholder | All | report screens; no PDF fn | Preview + share/download UI | Generate PDF + store path | `reports.pdf_file` + Storage | Unit + E2E | pdf lib | High | L | **Yes** |
| Onboarding → real inspection | Placeholder | All | `guided-inspection-placeholder`, `inspection-ready` | Route to real wizard | None if reuse createInspection | None | E2E | — | Med | S | **Yes** |
| Multi-select + bulk assign | Unreachable | All | `PRGPhotoGrid`, `bulk.tsx` | Select mode UX | Idempotent bulk assign API | Assignments | Unit+integ | — | Med | M | **Yes** |
| Password reset | Missing | All | auth screens | Forgot-password UI | Firebase only | — | Manual | — | Low | S | **Yes** |
| Sign in with Apple | Missing | iOS (+web optional) | auth | Apple button + flow | Firebase Apple provider | — | Device | Apple certs | High | M | **Yes** |
| Account deletion + web URL | Missing | All + web page | Profile; new CF | Settings UI | Cascade delete job | All user data | Integ | — | High | L | **Yes** |
| Native Google Sign-In | Defective | iOS/Android | `googleAuth.ts` | expo-auth-session / native | OAuth clients | — | Device | Google Cloud | High | M | **Yes** |
| Web Google reliable | Incomplete | Web | `googleAuth.ts` | Prefer redirect; recovery | Auth domain | — | Browser matrix | — | Med | M | **Yes** |
| Camera/photo permissions config | Missing | Native | `app.json` | Plugin strings | — | — | Build | expo-image-picker | High | S | **Yes** |
| Rename Insights → Reports | Misnamed | All | tabs layout | Rename + copy | — | — | Smoke | — | Low | S | **Yes** |
| Property create Cancel/discard | Missing | All | create + onboarding forms | Dirty guard | Ensure no writes | — | Unit+E2E | — | Med | S | **Yes** |
| Space delete → unassign photos | Defective | All | space detail; spaces.ts | Confirm copy | Clear space_id + assignments | photos | Integ | — | Med | S | **Yes** |
| Upload progress/retry | Incomplete | All | upload screens | Retry UI | Optional resume | — | Manual | — | Med | M | No* |
| Onboarding resume mid-flow | Incomplete | All | `routingResolver` | Persist step / gate tabs | Optional | prefs | E2E | — | Med | M | **Yes** |
| Residence history (archive, dates) | Partial | All | PropertyOverview; properties schema | Archive UX; move-in/out | Field allowlist | properties | Unit | — | Med | M | Soft |
| Profile legal + settings | Missing | All | profile.tsx | Links, version, reset | — | — | Manual | — | Low | S | **Yes** |
| Accessibility pass | Missing | All | components | Labels, focus, a11y | — | — | Manual a11y | — | Med | M | Soft |
| Analytics + monitoring | Missing | All | — | SDK events | Structured logs | — | — | Sentry/FA | Med | M | Soft |
| Expo dep alignment | Debt | Native | package.json | expo install | — | — | EAS build | — | High | S | **Yes** |
| Thumbnails / compression | Missing | All | upload pipeline | Client compress | Optional Sharp thumbs | Storage variants | Perf | sharp | Med | M | Soft |
| Assignment update/delete Fns | Missing | All | assignmentsService | Stop calling dead APIs or implement | Add endpoints | — | Integ | — | Low | S | Soft |
| Privacy Policy / Terms hosting | Missing | Web/legal | — | Static pages | Hosting | — | — | — | Med | M | **Yes** |
| CI/CD | Minimal | — | eas.json empty submit | — | GitHub Actions | — | PR checks | — | Med | M | Soft |
| Web production hosting | Missing | Web | — | Export/host | Firebase Hosting | — | Deploy | — | Med | M | Soft† |

\*Upload retry strongly recommended before public photo scale.  
†If desktop/mobile web are official MVP surfaces (per product objective): **Yes**.

Effort: S ≤3d, M ~1–2w, L ≥2w (one engineer).

---

## C. Architecture decisions (must decide before build)

### C1. PDF generation

| Option | Pros | Cons |
|--------|------|------|
| A. Server-side (Functions + Puppeteer/Playwright or PDFKit) | Identical output; works all platforms; snapshot → PDF | Cold start/cost; memory for images |
| B. Client-side (`expo-print` / html→PDF) | Fast UX on device | Inconsistent web vs native; heavy images on device |
| **Recommend: A (server)** | Consistent multi-platform; aligns with immutable snapshot; share same file from Storage | Use HTML template rendered server-side or PDFKit; store under `reports/{profileId}/{reportId}.pdf`; return signed short-lived download URL or stream via Function |

**Migration:** populate `reports.pdf_file` media id.  
**Cost:** Function memory 1–2GB during generate; cache PDF until report regenerated.

### C2. Photo thumbnails / compression

| Option | Recommend |
|--------|-----------|
| Client-only compress before upload | **Yes for MVP** — long edge ≤2048, JPEG ~0.7; HEIC→JPEG already |
| Server Sharp variants (thumb 400px + display 1600px) | **Phase 2 soft** — add if gallery lag |
| Keep original lossless | No — cost |

Store: `uploads/.../full_*.jpg` (+ later `thumb_`). Gallery uses display size only.

### C3. Upload retry

Recommend: per-file queue in UI; failed files remain selectable; retry calls `uploadFile`+`createPhoto` again (new media id OK). No multipart resume required for MVP.

### C4. Bulk assignment writes

Recommend: new HTTPS `bulkAssignPhotos` — single request `{ photoIds[], spaceId }`; server transaction/batch; ownership checks; response `{ succeeded[], failed[{id,error}] }`. Idempotent: set photo `space_id` + upsert one assignment row per photo (dedupe by photo_id).

### C5. Report snapshot immutability

Recommend: **immutable** `snapshot_json` + generated PDF. Corrections → new report version (`version`, `supersedes_report_id`) or new report from new inspection. Live property edits never rewrite old snapshots.

### C6. Property deletion

Recommend: **Archive by default** in UI; **permanent delete** behind second confirm explaining cascade (spaces, photos, Storage, inspections, reports). Keep existing server cascade delete. Soft-delete field optional later; archive status already exists.

### C7. Account deletion

Recommend: CF `deleteAccount` — Auth `deleteUser` after reauth; cascade all Firestore + Storage for profile; idempotent; Cloud Task/retry on partial failure. Web page for Play: form emailing support **or** authenticated deep link + public request form per Play policy.

### C8. Web hosting

Recommend: **EAS Hosting or Firebase Hosting** for production web + account-deletion page + Privacy/Terms. SPA rewrite rules for Expo Router.

### C9. Web authentication

Recommend: **email/password primary**; Google via **`signInWithRedirect`** on web (popup as optional desktop enhancement); persist `returnUrl`; handle `getRedirectResult` on root layout (already partial). Document browsers with third-party storage restrictions per Firebase docs.

### C10. Sign in with Apple

**Decision:** Because Google is offered as primary-account third-party login, **implement Sign in with Apple on iOS** (and web if Google is offered on web) to satisfy Apple Guideline 4.8 privacy-equivalent login. Email/password alone does not replace the Apple requirement when Google is present. Handle private relay emails; revoke Apple tokens on account delete where required.

### C11. Analytics

Recommend: **Firebase Analytics** (already have measurementId) + privacy allowlist of events. No addresses/notes/URLs.

### C12. Error monitoring

Recommend: **Sentry** (Expo) + Cloud Logging alerts on Functions. Alternative Crashlytics if staying Google-only.

### C13. Test framework

Recommend: **Jest/Expo** for client unit; **Detox or Maestro** later for native; **Playwright** for web E2E critical path; keep Node test runner for Functions mappers; add Functions integration tests with emulator.

### C14. CI/CD

Recommend: GitHub Actions — lint, `tsc`, unit tests, `expo export` web dry-run; EAS build on main; Functions deploy on tag; staging Firebase project.

---

## Phases (dependency-aware)

### Phase 0 — Stabilization (blocker)
- Align Expo deps (`npx expo install`).  
- Remove token logging.  
- Add `app.json` camera/photo permission strings + image-picker plugin.  
- Root `.env.example`.  
- Fix/remove dead assignment client methods or implement stubs.  
- Confirm EAS builds for iOS/Android.  

### Phase 1 — Auth & account (blocker)
- Password reset.  
- Map Firebase error codes → human messages.  
- Native Google Sign-In.  
- Web Google redirect hardening + return route.  
- Sign in with Apple (iOS; web if Google on web).  
- Account deletion CF + Profile UI + public web deletion page.  
- Session expiry → re-login UX.  

### Phase 2 — Onboarding & property reliability (blocker)
- Replace inspection placeholder with real `inspections/new` or wizard.  
- Resume/gating: persist onboarding step; block tabs until complete **or** allow skip-property with empty state (PO decision).  
- Property create Cancel + dirty discard (list + onboarding); mirror browser/native back.  
- Idempotent create (client requestId optional).  
- Space delete → unassign photos + confirm copy.  
- Fix `lease_term` update allowlist.  

### Phase 3 — Photos & multi-select (blocker)
- Explicit Select mode on all assign entry points.  
- Bulk assign via `bulkAssignPhotos`.  
- Upload progress + retry.  
- Client compression targets.  
- Gallery filters (space / unassigned).  

### Phase 4 — Inspection completion (blocker)
- Onboarding start + property start unified.  
- Pause/resume verified; prevent duplicate active inspections per property (rule).  
- Completion → immutable snapshot (define schema).  
- New inspection ≠ overwrite old report.  

### Phase 5 — Reports & PDF (blocker)
- Server PDF from snapshot.  
- Native share sheet; web download.  
- Rename Insights → **Reports**.  
- Empty/loading/error states; sort newest first.  

### Phase 6 — Residence history foundation (soft blocker for “history” claim)
- `move_in_date`, optional `move_out_date`.  
- Current vs previous (archive + dates).  
- Chronological list sections.  
- Archive default; permanent delete secondary.  

### Phase 7 — Profile, legal, a11y, responsive
- Privacy, Terms, Support, version.  
- Responsive layouts (mobile/tablet/desktop).  
- Accessibility pass.  
- Unified error handling helper.  

### Phase 8 — Analytics, monitoring, cost
- Event taxonomy (no PII content).  
- Sentry + Function alerts.  
- Storage/Functions cost dashboards.  

### Phase 9 — QA & release
- Platform matrix testing.  
- Store listings, Data Safety, privacy nutrition labels.  
- Staging → production.  

---

## Key product-owner decisions (required before/during build)

1. **Skip first property in onboarding?** Recommend: **No skip** for MVP coherence; allow “Add later” only after empty-state education **or** require first property (simpler). **Recommend require first property** with Cancel that exits to signed-in empty state without orphan writes.  
2. **Photo model:** Keep **one space per photo** (current). Multi-space via assignments table is secondary; bulk assign updates primary `space_id`.  
3. **PDF disclaimer legal text** — PO/counsel approve.  
4. **Activation photo threshold** (analytics) — recommend **6** configurable.  
5. **Staging Firebase project** — create separate project vs prefixes.  
6. **Web in v1 store marketing** — full support vs “mobile apps primary, web beta”.  
7. **Archive vs hard delete default** — recommend archive-first.  

---

## Representative task format (examples)

### Task: Server PDF generation for report snapshot
- **User problem:** Cannot download/share inspection PDF.  
- **Objective:** Generate PDF from immutable snapshot; store; return download.  
- **Affects:** `functions/src/http/reports.ts`, `firestore/reports.ts`, report UI screens.  
- **New:** `functions/src/pdf/renderReport.ts`, HTML/CSS template, Storage write.  
- **API:** `POST generateReportPdf { reportId }` → `{ data: { fileId, downloadPath } }`; `GET` download via signed URL or `getFile`.  
- **Errors:** missing photos, timeout, oversized — user-visible retry.  
- **A11y:** Download button labeled; progress announced.  
- **Analytics:** `pdf_generation_started|succeeded|failed`, `pdf_downloaded`, `pdf_shared`.  
- **Tests:** unit mapping; integ generate; E2E web download; manual native share.  
- **Acceptance:** Snapshot unchanged after property edit; PDF contains spaces/photos/notes/disclaimer/page numbers; works iOS/Android/web.  
- **Deps:** Phase 4 snapshot schema. **Risk:** High (memory). **Effort:** L.  

### Task: Explicit multi-select + bulkAssignPhotos
- **User problem:** Cannot assign many photos to a room in one action.  
- **Objective:** Shared selection mode + atomic/idempotent bulk API.  
- **Affects:** `PRGPhotoGrid`, `PropertyPhotos`, space screens, `assignments/bulk.tsx`, `http/photos.ts`.  
- **API:** `bulkAssignPhotos` as above.  
- **Acceptance:** Select button; counter; Cancel; Assign disabled at 0; partial failure reporting; no duplicate writes; works touch/keyboard.  
- **Effort:** M. **Blocker:** Yes.  

### Task: Account deletion
- **User problem:** Store compliance + user control.  
- **Objective:** In-app delete + web request URL; cascade data.  
- **Affects:** Profile, new CF, Hosting page.  
- **Acceptance:** Reauth; confirm; deletes Auth+Firestore+Storage; idempotent; Play URL works logged-out.  
- **Effort:** L. **Blocker:** Yes.  

*(Full backlog should expand every Phase 0–9 item into this template in the project tracker.)*

---

## Final outputs

### Current vs required (summary)

| Required journey step | Now |
|----------------------|-----|
| Understand product | Partial (welcome) |
| Account create/sign-in | Email OK; Google incomplete; Apple missing; no reset |
| Onboarding | Works until fake inspection |
| Create property / cancel clean | Create OK; Cancel/discard missing |
| Spaces review/edit | OK; delete orphans photos |
| Multi photo + multi-select assign | Single OK; multi missing |
| Notes | OK |
| Guided inspection pause/resume/complete | In-app OK; onboarding stub |
| Report snapshot | OK |
| PDF generate/download/share | Missing |
| Return later | OK if same account |
| Multiple residences / history | Multi-property OK; archive partial; no move-in/out |

### Proposed final MVP architecture

```
Expo (iOS/Android/Web)
  → Firebase Auth (Email, Google, Apple)
  → Cloud Functions HTTPS
       → Firestore (profiles, properties, spaces, photos, assignments,
                    inspections, steps, reports, media_files)
       → Storage (images + PDFs) via Admin SDK / short-lived URLs
  → Analytics (FA) + Sentry
Hosting: Privacy, Terms, Account deletion web form
```

### Critical path

`Expo dep fix + permissions` → `Auth (reset, Google native, Apple, deletion)` → `Onboarding real inspection + cancel/discard + resume` → `Multi-select + bulk assign + space-delete fix` → `Immutable snapshot polish` → `PDF` → `Rename Reports` → `Legal/Profile` → `A11y/responsive` → `Analytics/monitoring` → `Store QA`.

### DB / Storage migration plan

1. Add optional fields: `properties.move_in_date`, `move_out_date`; `reports.version`, `pdf_file`, `generated_at`.  
2. Backfill none required (greenfield OK).  
3. On space delete: batch clear `photos.space_id` where matching.  
4. PDF objects under `reports/{appProfileId}/...`.  
5. Deploy Functions before clients that require new APIs.  

### Testing matrix (platforms)

| Journey | iOS | Android | Mobile Safari | Mobile Chrome | Desktop Chrome/Safari/Edge |
|---------|-----|---------|---------------|---------------|----------------------------|
| Auth email | Manual+auto | Manual+auto | Manual | Manual | Playwright |
| Google | Device | Device | Redirect QA | Redirect QA | Redirect QA |
| Apple | Device | N/A | If offered | — | If offered |
| Property cancel | Manual | Manual | Manual | Manual | Auto |
| Multi-select assign | Manual | Manual | Manual | Manual | Auto |
| Inspection+PDF | Manual | Manual | Manual | Manual | Auto |
| Account delete | Manual | Manual | Web form | Web form | Web form |

### Security & privacy checklist (launch)

- [ ] Auth on all protected Functions  
- [ ] Ownership checks (property/space/photo/report)  
- [ ] MIME/size validation  
- [ ] No public Storage objects  
- [ ] No tokens in logs  
- [ ] App Check evaluated (recommend **enforce before public launch**)  
- [ ] Privacy Policy data inventory  
- [ ] Account deletion cascade verified  
- [ ] Analytics scrubbed  

### Store & web launch checklist

- [ ] Privacy/Terms URLs live  
- [ ] Account deletion in-app + Play web URL  
- [ ] Sign in with Apple (with Google)  
- [ ] Camera/photo usage strings  
- [ ] Data Safety / App Privacy answers  
- [ ] Support URL  
- [ ] EAS production builds submitted  
- [ ] Test accounts for Review  
- [ ] Web hosting + deep links  

### Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF memory/timeouts | Launch fail | Cap images/page; async job + poll |
| Apple 4.8 rejection | Block submit | Ship Apple Sign-In with Google |
| Expo dep skew | Native build fail | Phase 0 pin versions |
| Google web COOP | Auth fail | Redirect-first |
| Storage cost photos | Burn budget | Compress; lifecycle; monitoring |
| Orphan data on delete | Privacy incident | Idempotent cascade + audits |
| Scope creep AI/legal | Delay | Explicit out-of-scope list |

### Effort range (1 senior engineer)

| Phase | Estimate |
|-------|----------|
| 0 Stabilization | 3–5 days |
| 1 Auth & deletion | 1.5–2.5 weeks |
| 2 Onboarding/property | 1–1.5 weeks |
| 3 Photos/multi-select | 1.5–2 weeks |
| 4 Inspection polish | 3–5 days |
| 5 PDF + Reports rename | 1.5–2.5 weeks |
| 6 Residence history | 3–5 days |
| 7 Profile/a11y/responsive | 1–1.5 weeks |
| 8 Analytics/monitoring | 3–5 days |
| 9 QA & release | 1.5–2 weeks |
| **Total** | **~10–16 weeks** |

### Suggested sprint grouping (2-week sprints)

1. Phase 0 + password reset + permissions + Insights rename  
2. Google native + Apple + web redirect  
3. Account deletion + legal pages hosting  
4. Onboarding inspection + cancel/discard + resume  
5. Multi-select + bulk API + space delete fix  
6. Upload retry/compress + gallery filters  
7. PDF backend + UI share/download  
8. Residence dates/archive + profile settings  
9. A11y + responsive + analytics/Sentry  
10. Full matrix QA + store submit  

### Launch-readiness definition

MVP is launch-ready when:

1. Critical journey passes on iOS, Android, mobile Safari, mobile Chrome, desktop Chrome without placeholders.  
2. PDF download/share works from a saved snapshot.  
3. Auth includes email, Google (native+web), Apple (iOS), password reset, deletion (app+web).  
4. Store permission strings, Privacy, Terms, Data Safety complete.  
5. No known P0 bugs in upload/assign/inspection/PDF.  
6. Basic analytics funnel + error monitoring live.  
7. Staging signed off; production Firebase + EAS builds tagged.

### Explicitly out of MVP (do not build)

AI analysis, legal advice, payments/subscriptions, landlord/PM orgs, roommate collab, public share links (except PDF file delivery), screening/FCRA, immigration exports, marketplace, ads, full offline, OCR, attorney review.

---

## Appendix — Photo assignment model (explicit)

**Decision:** Product model remains **one primary space per photograph** (`photos.space_id` + `assignment_status`).  
`photo_assignments` may store audit/history but bulk assign must upsert to avoid duplicates.  
UI copy: “Assign to space” replaces prior space assignment.

---

*End of plan. Awaiting review approval before implementation.*

---

## Detailed domain plans (implementation guidance)

### 5. Authentication and account management

#### Current verified behavior
- Email/password signup + login: `app/(auth)/signup.tsx`, `login.tsx` → Firebase Auth → `bootstrapProfile`.
- Session: Firebase persistence + `SecureStore`/`localStorage` keys `firebase_id_token` / `firebase_user`.
- Google: `src/services/googleAuth.ts` — web uses popup then redirect fallback; **native throws** “not implemented”.
- No password-reset screen; no Apple; no account deletion.

#### Required methods (plan)

| Method | Approach |
|--------|----------|
| Email signup/signin | Keep; improve error mapping (`auth/email-already-in-use`, `wrong-password`, `too-many-requests`) |
| Password reset | `sendPasswordResetEmail` + `app/(auth)/forgot-password.tsx` linked from login |
| Persistent sessions | Keep Firebase persistence; clear storage on sign-out |
| Sign-out | Existing; ensure profile/prefs cache cleared |
| Expired session | `backendClient` 401 → force re-auth modal + redirect to login preserving path |
| Unauthorized API | Map 403 to “You don’t have access…”; never show stack |

#### Google on web (official Firebase guidance)

**Recommended strategy:**
1. **Default to `signInWithRedirect`** on all web (desktop + mobile browsers).
2. On app root mount (`app/_layout.tsx`), always call `getRedirectResult(auth)` once and complete bootstrap.
3. Persist `auth_return_to` in `sessionStorage` before redirect; restore after success.
4. Keep popup as **optional desktop-only** enhancement behind feature flag; on `auth/popup-blocked` or COOP errors, fall back to redirect automatically.
5. Document known issues for ITP / third-party cookie restricted browsers; use Firebase Auth custom domain if needed (`auth.yourdomain.com`).
6. Authorized domains: Firebase Console must list production web domain + localhost.

#### Google on native
- Use `@react-native-google-signin/google-signin` **or** Expo Auth Session with Google OAuth + `signInWithCredential`.
- Configure iOS URL schemes / Android SHA-1 for OAuth clients.
- Same Firebase user linking rules as web.

#### Sign in with Apple (Guideline 4.8)

**Finding:** Offering Google as a third-party login to establish the primary account triggers the requirement for an *equivalent* privacy-respecting login. Sign in with Apple satisfies the three criteria and is the practical compliance path. Email/password does **not** remove the obligation when Google remains offered.

**Implement:**
- iOS: `expo-apple-authentication` + Firebase `OAuthProvider('apple.com')`.
- Web: Apple JS / Firebase Apple provider if Google is offered on web.
- Private relay: store relay email as Auth email; display “Hide My Email” note in Profile; do not require “real” email.
- Account linking: detect `auth/account-exists-with-different-credential`; offer link flow with clear copy.
- Account deletion: revoke Apple refresh token via REST when provider is Apple (Apple requirement for token revocation).
- Test on physical devices (Simulator Apple Sign-In is limited).

#### Account deletion (Apple 5.1.1(v) + Play User Data)

**In-app:** Profile → Delete account → explain cascade → reauthenticate (password or provider) → confirm → call `deleteAccount` Function → sign out → success screen.

**Backend `deleteAccount` (idempotent):**
1. Verify Auth UID matches.
2. Resolve `app_profiles` by `firebase_uid`.
3. List all properties → cascade (reuse property delete: spaces, photos, media, assignments, inspections, steps, reports, PDFs).
4. Delete `user_preferences`, `app_profiles`, remaining `media_files`.
5. Delete Firebase Auth user (Admin SDK).
6. If steps 3–5 partially fail, write `deletion_jobs/{uid}` with status and retry via Cloud Scheduler/Tasks until complete; user-facing: “Deletion in progress; contact support with reference CODE”.

**Web resource (Play):** Public HTTPS page (no app install) with discoverable form: email + confirmation text → creates support ticket **or** authenticated deletion after magic link. Submit URL in Play Console Data Safety.

**Retention:** Document in Privacy Policy: operational logs retained ≤90 days; backups ≤30 days then purged; analytics without PII content.

---

### 6. Onboarding

**Current:** `name` → `language` → `property-info` → `lease-info` → `nickname` → creates property → `inspection-ready` → **`guided-inspection-placeholder`** (dead end).

**Target flow:** Welcome → Auth → Name → Language → Property address (international-friendly fields) → Lease/occupancy (optional fields labeled) → Nickname (optional) → Review → Create property (idempotent) → **Start real inspection** (`/inspections/new?propertyId=`) or property overview with CTA.

**Skip first property?** Recommend **do not skip** for MVP: empty app without property confuses the inspection promise. Cancel on property steps exits to Properties empty state without writes.

**Resume:** Persist `onboarding_step` in `user_preferences` or SecureStore; on login, route to step; if property already created (`has_completed_onboarding` / property count > 0), never re-enter create flow.

**Validation:** Shared `validation.ts` schema used by onboarding + property create; DateField already platform-aware — keep.

**Network:** Create property once; disable submit; client `Idempotency-Key` header optional on `createProperty`.

---

### 7–8. Properties & spaces

**Cancel property create:** Shared hook `useDiscardableForm` — dirty detection, Confirm discard, Cancel always visible in header (iOS left / Android close / web header). Apply to `properties/create.tsx`, onboarding property/lease/nickname chain (cancel aborts whole create), any modal.

**Archive vs delete:** List “Current” and “Previous (archived)”. Archive sets `status=archived` + optional `move_out_date`. Permanent delete second confirm + cascade (existing server delete).

**Space delete:** Confirmation: “Photos will become Unassigned; they will not be deleted.” Server: clear `space_id`, set `assignment_status=unassigned`, delete related assignment rows.

**Photo–space cardinality:** **One primary space per photo** (preserve current). Document in schema comments.

---

### 9–10. Photos & multi-select

**Capture/import:** Keep `expo-image-picker` / camera; web file input; add permission denied education sheets. Validate MIME (jpeg/png/heic→jpeg) and size (recommend 15MB client; 20MB server).

**Upload UX:** Per-file status (queued/uploading/done/failed); retry failed; disable double-submit; on background, do not mark success until Function returns.

**Storage strategy (MVP):**
- Original retained as uploaded (already compressed client-side to ≤2048px JPEG q≈0.7).
- Thumbnails: defer server Sharp unless gallery >50 photos lag; then add 400px thumb.
- Paths: existing `uploads/{appProfileId}/{fileId}_{safeName}`.
- Access: only via `getFile` signed/authenticated URL — never public ACL.
- Delete photo: delete Firestore + Storage + registry.

**Multi-select:** Wire `PRGPhotoGrid` `selectionMode`; entry points: property gallery, space add-photos, bulk route. Shared `PhotoSelectionBar` component. Backend `bulkAssignPhotos`. Optional: Select all visible, Clear, long-press enter mode (native), Shift-click range (desktop) — **post-core**, not blockers. Explicit Select button required.

---

### 11. Guided inspection

**Statuses:** Inspection: `draft | in_progress | completed | cancelled`. Steps: `pending | skipped | completed`.

**Resume:** Open latest non-completed for property; continue at first incomplete step.

**Space changes after create:** New spaces → append steps (optional prompt). Deleted spaces → mark step `cancelled` / skip; photos remain unassigned.

**Completion:** Write immutable `reports.snapshot_json` including property nickname, address, dates, spaces, photo refs+notes, inspection meta, disclaimer version. Do not edit completed inspection; corrections → new inspection → new report version.

**Onboarding:** Replace placeholder with `createInspection` + wizard UI (reuse `inspections/[id].tsx`).

**Duplicate active:** Server rejects second `in_progress` for same property+type unless PO allows parallel (recommend reject).

---

### 12–13. Reports & Insights rename

**PDF contents:** As specified in requirements + disclaimer (user documentation; not legal advice / professional inspection / admissibility guarantee). Never “court-ready”.

**Server generate** from snapshot only. Client: preview (WebView/PDF viewer where available), Share API native, `<a download>` web.

**Rename tab** `Insights` → `Reports` in `app/(tabs)/_layout.tsx` and folder rename (or label-only to reduce churn — prefer label + route alias).

---

### 14–16. Residence history, Profile, Responsive

**History MVP:** Multiple properties; `status` current/archived; `move_in_date` required on create; `move_out_date` optional on archive; lease dates optional; chronological sort; reports still reachable from archived property.

**Profile:** Display name (editable), email (read-only), language, theme, sign-out, password reset entry, Privacy, Terms, Support, data export explanation (“email support”), account deletion, version from `expo-constants`.

**Responsive breakpoints (suggested):**
- Compact: <600px — tab bar bottom, single column.
- Medium: 600–1023 — wider gallery columns, max form width 560.
- Expanded: ≥1024 — optional side nav or persistent secondary panel; content max ~960–1120 centered; property detail master-detail where natural.

**Web output:** Expo web static export or Metro SSR-less SPA on Firebase Hosting / EAS Hosting with rewrite to `index.html`.

**Browsers supported:** iOS Safari, Android Chrome, Desktop Chrome/Safari/Edge (last 2 versions). **Excluded:** IE, Opera Mini, browsers without ES2017.

---

### 17–18. Accessibility & errors

**A11y MVP pass:** labels on all icon buttons; photo selected state `accessibilityState.selected`; web focus rings; 44pt targets; contrast AA; associate errors with inputs; keyboard: tab order Select/Assign; announce toast failures.

**Unified errors:** `src/utils/userFacingError.ts` maps codes → `{ title, message, retryable }`. Use in services. Never claim success on partial failure.

---

### 19–21. Security, analytics, monitoring

**Security:** Keep deny-all client rules; App Check (DeviceCheck/Play Integrity/reCAPTCHA) **recommended enforce before public launch**; rate-limit uploads (e.g. 50/hour/user); separate Firebase projects for staging/prod.

**Analytics events:** Use the list in the requirements; scrub PII. Funnel dashboard in FA: signup → onboarding → property → ≥N photos (config **6**) → assigned → inspection started → completed → PDF shared → D7 return.

**Monitoring:** Sentry client; Functions error rate alert; Storage egress alert; PDF latency P95.

---

### 22–24. Testing, performance, release

#### Performance targets (propose)

| Metric | Target |
|--------|--------|
| Initial JS load (web cold) | < 4s on mid broadband |
| Authenticated home | < 2s to interactive list |
| Property list | < 1.5s for ≤20 properties |
| Gallery first paint | < 1.5s with thumbnails; virtualize >40 |
| Thumbnail load | < 500ms cached |
| Upload feedback | Progress within 300ms of start |
| Inspection step change | < 200ms UI |
| Report open | < 2s metadata |
| PDF generation | < 30s typical (≤40 photos); async job if longer |

#### Release env

| Env | Firebase | EAS profile | Domain |
|-----|----------|-------------|--------|
| Dev | current project or `prg-dev` | development | localhost |
| Staging | `prg-staging` | preview | staging.renterguardian… |
| Prod | `prg-prod` | production | app.renterguardian… |

Secrets via EAS Secrets + GitHub Environments. Functions deploy per project.

---

## Sequenced implementation backlog (task IDs)

Use each ID as a ticket; expand with the required task template fields in the tracker.

### Phase 0
- `P0-1` Align Expo 51 dependencies (`expo install`)
- `P0-2` Remove Firebase token console logging
- `P0-3` Add camera/photo library usage strings + plugins in `app.json`
- `P0-4` Add root `.env.example`; document required vars
- `P0-5` Fix or remove client `updateAssignment`/`deleteAssignment` dead calls
- `P0-6` Baseline: Functions `npm test` + typecheck in CI stub

### Phase 1
- `P1-1` Password reset screen + Firebase email
- `P1-2` Auth error message map
- `P1-3` Native Google Sign-In
- `P1-4` Web Google redirect-first + return route recovery
- `P1-5` Sign in with Apple (iOS; web if Google on web)
- `P1-6` Account linking / duplicate email UX
- `P1-7` `deleteAccount` Cloud Function cascade + idempotent job
- `P1-8` In-app Delete account UI + reauth
- `P1-9` Public web account-deletion page + Play URL
- `P1-10` Expired session / 401 handling

### Phase 2
- `P2-1` Replace onboarding inspection placeholder with real inspection start
- `P2-2` Onboarding step persistence + completed gate
- `P2-3` Shared discardable Cancel for property create (list + onboarding)
- `P2-4` Browser Back / native back = discard behavior
- `P2-5` Analytics: property create started/canceled/completed
- `P2-6` Space delete unassigns photos (BE + FE confirm)
- `P2-7` Allowlist `lease_term` (+ move_in/out fields prep)

### Phase 3
- `P3-1` PhotoSelectionMode + Select button on gallery entry points
- `P3-2` `bulkAssignPhotos` Function + client
- `P3-3` Partial failure UI; preserve selection on fail
- `P3-4` Upload per-file status + retry
- `P3-5` Client image compression pipeline
- `P3-6` Gallery filter unassigned/by space; empty/error states

### Phase 4
- `P4-1` Inspection status rules + duplicate active prevention
- `P4-2` Pause/resume verification + autosave
- `P4-3` Snapshot schema freeze + immutability tests
- `P4-4` Space add/delete mid-inspection behavior
- `P4-5` Post-completion: new inspection creates new report only

### Phase 5
- `P5-1` Server PDF renderer from snapshot
- `P5-2` Store PDF in Storage; link on report
- `P5-3` Native share/save PDF
- `P5-4` Web download PDF (no popup dependency)
- `P5-5` Rename Insights → Reports (UI + copy)
- `P5-6` Cross-property report list polish (sort, empty, error, open PDF)

### Phase 6
- `P6-1` `move_in_date` / `move_out_date` fields + UI
- `P6-2` Archive flow as default “move out”
- `P6-3` Current vs previous residence list sections
- `P6-4` Permanent delete confirm copy cascade

### Phase 7
- `P7-1` Profile: legal links, support, version, reset entry
- `P7-2` Host Privacy Policy + Terms pages
- `P7-3` Responsive layout pass (breakpoints)
- `P7-4` Accessibility pass critical journey
- `P7-5` Unified `userFacingError` adoption

### Phase 8
- `P8-1` Firebase Analytics event wiring (allowlisted)
- `P8-2` Activation funnel dashboard
- `P8-3` Sentry (or Crashlytics) client
- `P8-4` Functions structured logging + alerts
- `P8-5` App Check enablement plan

### Phase 9
- `P9-1` Playwright web critical path
- `P9-2` Native manual regression checklist
- `P9-3` Staging Firebase + EAS preview
- `P9-4` Store listings / Data Safety / privacy labels
- `P9-5` Production deploy + rollback runbook

---

## Worked example — full task template

### P3-2 — bulkAssignPhotos API and client

| Field | Content |
|-------|---------|
| **Title** | Idempotent bulk photo → space assignment |
| **User problem** | Assigning many photos one-by-one is too slow; bulk UI exists but is incomplete |
| **Technical objective** | Single authenticated endpoint assigns N photos to one space with ownership checks and per-item errors |
| **Existing code** | `functions/src/http/photos.ts`, `firestore` photos/assignments, `assignmentsService.ts`, `app/.../assignments/bulk.tsx`, `PRGPhotoGrid.tsx` |
| **New modules** | `bulkAssignPhotos` handler; `src/hooks/usePhotoSelection.ts`; selection action bar component |
| **Frontend** | Selection mode; call bulk API; success toast with count; show failed IDs; exit selection on full success |
| **Backend** | Verify profile owns every photo + destination space; same property; batch writes; reject cross-property |
| **Data model** | Update `photos.space_id` + `assignment_status`; upsert assignment docs keyed by photo_id |
| **API contract** | `POST bulkAssignPhotos` body `{ photo_ids: string[], space_id: string }` → `{ data: { succeeded: string[], failed: { id, code, message }[] } }` |
| **Migration** | None; optional cleanup duplicate assignment docs |
| **Error cases** | Empty list; deleted photo; deleted space; mixed ownership; network timeout mid-batch (transaction or compensating clear) |
| **A11y** | Select announces mode; selected state; Assign disabled reason |
| **Analytics** | `bulk_assignment_started|completed|failed` with counts only |
| **Automated tests** | Unit selection reducer; integ mixed authz; repeated submit idempotent |
| **Manual tests** | iOS/Android/web select many, scroll, cancel, reassign, fail space deleted |
| **Acceptance** | Matches §10 acceptance criteria in product brief |
| **Dependencies** | P3-1 |
| **Risk** | Medium (partial writes) |
| **Effort** | M (3–5 days) |
| **DoD** | Merged with tests green; QA signed on 3 platforms; dead orphan bulk route either fixed or removed |

---

## Distinction legend (for tickets)

| Label | Meaning |
|-------|---------|
| **Verified** | Exists in repo and behaves correctly |
| **Incomplete** | Exists but gaps vs MVP |
| **Defective** | Exists but wrong/broken |
| **Placeholder** | UI only |
| **MVP work** | Required to claim MVP complete |
| **Launch-ready** | Store/compliance/ops beyond core journey |
| **Post-MVP** | Explicitly out of scope |

