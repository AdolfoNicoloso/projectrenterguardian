# CodingRules.md — Project Renter Guardian (PRG)

This document defines the non-negotiable rules for modifying the PRG codebase. Cursor (and all contributors) must follow these rules on every code edit to preserve a clean architecture, prevent regressions, and keep the repository onboarding-friendly.

---

## 0) Prime Directive

- **Do not break existing behavior.**
- **Prefer small, incremental changes** over large refactors.
- **Keep the architecture consistent** with the current structure described in `README.md`.
- When in doubt: **match existing patterns** in the closest neighboring files.

---

## 1) “Where Things Go” (Source of Truth)

### Routes / Navigation Screens
- **All route screens live in:** `app/` (Expo Router file-based routing).
- Routes must remain **thin**:
  - UI composition
  - input collection
  - calling services
  - navigation
  - showing loading/error states
- Routes must **not** contain complex business logic, multi-step orchestration, or backend request assembly.

### Reusable UI Components
- **All shared UI components live in:** `src/components/`
- Naming:
  - PRG components use `PRG*` prefix (e.g., `PRGButton`, `PRGCard`).
- Components should be:
  - Presentational where possible
  - Configurable via props
  - Free of backend calls

### Screen Modules (Composite UI)
- If a route screen becomes large:
  - Extract composite UI into `src/screens/`
- `src/screens/` may contain:
  - complex layout composition
  - internal view-state for that screen
- `src/screens/` should **still not** contain direct backend calls beyond invoking services.

### Business Logic & API
- **All backend calls and orchestration live in:** `src/services/`
- Route screens should call:
  - `propertiesService`, `spacesService`, `photosService`, `inspectionsService`, etc.
- **Canonical backend access is via:** `src/services/backendClient.ts`
- Directus is **not accessed directly for user-owned data**.
  - If Directus is needed for public CMS content only, use the CMS-only client.

### State Management
- Global state is in: `src/state/` (Zustand).
- Only store globally what is truly cross-screen (e.g., auth/session).
- Prefer local `useState` for transient screen-only state.

### Types
- All domain types are in: `src/types/`
- Types must reflect:
  - actual backend payload shapes
  - real Directus collections/fields
- Do not invent fields in types unless backend supports them.

### Utilities
- Cross-cutting helpers live in: `src/utils/`
- Utilities must be:
  - deterministic
  - side-effect free where possible
- Centralized helpers must be used instead of duplicating logic across screens:
  - `directusDate.ts` for date formatting
  - `validation.ts` for form validation
  - `errorHandler.ts` for error normalization and messaging
  - `fileUrl.ts` for file URL generation

### Theme / Design System
- Theme tokens live in: `src/theme/`
- Do not hardcode colors/spacing if a token exists.

---

## 2) Dependency & Architecture Rules

### Backend Data Access Rules (Strict)
- ✅ Allowed:
  - Client → `backendClient` → Firebase Functions → Directus
- ❌ Not allowed:
  - Client calling Directus CRUD for user-owned data directly
  - Exposing Directus credentials or tokens to the client
- If you see direct user-data calls to Directus:
  - Replace them with a Firebase Function call via `backendClient` and a domain service.

### Service Layer Rules
- Each domain service:
  - owns its endpoint mapping and request options
  - returns typed data
  - throws errors in a consistent format
- Services should not manipulate navigation or UI.

### File Upload Rules
- Upload pipeline belongs in a service (`photoUploadService.ts`).
- Route screens only:
  - request permissions
  - pick/capture images
  - call the upload service
  - show progress and toasts

---

## 3) Naming Conventions (Consistency Matters)

### File & Folder Naming
- `camelCase.ts` for most TS files
- `PascalCase.tsx` for React components
- `PRG*` prefix for design system components

### Type Naming
- Interfaces/types are `PascalCase` (e.g., `Property`, `Space`, `Photo`).

### Backend Field Names
- Prefer **snake_case** in objects that map to Directus payloads.
- Do not silently convert naming conventions unless the existing codebase already does so in a standardized way.

### Route Params
- Keep route param names consistent with file structure:
  - `app/(tabs)/properties/[id].tsx` → `id`
  - `.../photos/[photoId].tsx` → `photoId`
  - `.../spaces/[spaceId].tsx` → `spaceId`

---

## 4) Error Handling & UX Rules

### Error Handling (Standard)
- Use the centralized error utility:
  - `src/utils/errorHandler.ts`
- User-facing errors:
  - show via the Toast system (`PRGToastProvider`)
- Debugging:
  - log errors with `console.error` (or future logging tool)

### Loading States (Standard)
- Use the existing loading patterns:
  - button-level loading (`PRGButton loading`)
  - overlay loading (`PRGLoadingOverlay`) where used
- Do not introduce a new loading approach without aligning the app.

### Navigation
- Prefer route constants in `src/navigation/routes.ts` instead of hardcoded strings.
- Maintain current navigation semantics:
  - do not change `push` vs `replace` without a clear reason

---

## 5) Code Quality Rules (Practical)

### Scope Control
- Each PR/commit should solve **one** concern.
- Avoid broad refactors mixed with feature work.

### Avoid Duplication
- Before adding a helper or component:
  - search the codebase for an existing equivalent
- If duplication exists, prefer consolidating into `src/utils/` or `src/components/`.

### Keep Screens Thin
- If a route screen exceeds ~250–300 lines:
  - extract UI into `src/screens/`
  - extract logic into `src/services/` or `src/utils/`

### Avoid Leaky Abstractions
- Do not pass raw backend responses deep into component trees.
- Transform data once in the screen or service, then pass clean props down.

---

## 6) Testing & Verification (Minimum Required)

Before finalizing any code change:
- Run:
  - `npm start`
  - at least one platform: `npm run ios` or `npm run android` or `npm run web`
- Smoke test critical flows:
  - login
  - properties list + create property
  - create space
  - upload photo and confirm it renders in grid
  - start an inspection (if relevant to changes)

If your change touches backend calls or auth:
- Verify token handling remains intact.
- Verify Firebase Function calls still include valid auth headers.

---

## 7) Documentation Rules

### When to update docs
- If you add/remove/rename:
  - routes
  - services
  - environment variables
  - core workflows
  - major folders
- Then update:
  - `README.md` (architecture/workflows)
  - `QUICKSTART.md` (setup/run changes)

### README is a contract
- Do not let README drift from the repo’s real structure.

---

## 8) “If You’re Unsure” Checklist

If any change is ambiguous:
- Stop and do these checks before proceeding:
  - Identify the nearest existing pattern in the repo and match it
  - Search imports/usages to avoid breaking changes
  - Confirm the correct layer:
    - route UI → `app/`
    - business logic → `src/services/`
    - shared helpers → `src/utils/`
    - shared UI → `src/components/`

---

## 9) Prohibited Changes Without Explicit Approval

Do not do any of the following unless explicitly instructed:
- Replace navigation framework or state library
- Introduce a new backend access pattern (e.g., direct Directus user-data calls)
- Add a new design system or styling approach
- Rename core domain entities or change API contracts
- Move major folders without updating documentation

---

## End
If you follow this document, PRG remains consistent, maintainable, and easy for new engineers to onboard.
