# Project Renter Guardian (PRG)

Mobile-first React Native app with web support for documenting rental properties. Helps renters document property condition during move-in inspections.

## Tech Stack

- **Expo** ~51.0.0 - React Native framework
- **React Native** 0.74.0 - Mobile UI framework
- **React** 18.2.0 - UI library
- **TypeScript** ~5.3.0 - Type safety
- **Expo Router** ~3.5.0 - File-based routing
- **Zustand** ^4.5.0 - State management
- **Firebase** ^10.7.1 - Authentication
- **Directus** - CMS backend (via Firebase Functions)

## Quick Start

See [QUICKSTART.md](./docs/QUICKSTART.md) for a 3-step guide.

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

**Required (Firebase Authentication):**
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**Optional (Backend Connection):**
```env
# Directus instance URL (if not set, app runs in mock mode)
EXPO_PUBLIC_DIRECTUS_URL=https://your-directus-instance.com

# Firebase Functions URL (defaults to production if not set)
EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net

# Firebase Emulator (for local development)
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=localhost
EXPO_PUBLIC_FIREBASE_EMULATOR_PORT=5001
```

### 3. Verify Setup

```bash
npm run verify-setup
```

### 4. Start Development Server

```bash
# Start Expo dev server
npm start

# Or start with specific platform
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

## Run Commands

- `npm start` - Start Expo dev server
- `npm run ios` - Start with iOS simulator
- `npm run android` - Start with Android emulator
- `npm run web` - Start web version
- `npm run setup-assets` - Create placeholder assets
- `npm run verify-setup` - Verify configuration

## Architecture Overview

### Hybrid Backend Architecture

The app uses a **hybrid backend** combining:
- **Firebase Authentication** - User authentication (email/password, Google Sign-In)
- **Firebase Functions** - Backend API layer (enforces ownership, handles Directus operations)
- **Directus CMS** - Data storage (accessed via Firebase Functions, NOT directly)

**Key Principle:** All user-owned data operations go through Firebase Functions to enforce ownership via `app_profile_id`. Directus client is only used for public CMS content (disclaimers, jurisdiction context).

### Project Structure

```
app/                          # Expo Router file-based routing
  (auth)/                     # Authentication flow
    login.tsx
    signup.tsx
  (tabs)/                      # Main app (4 tabs)
    properties/                # Properties tab
      index.tsx                # Properties list
      create.tsx               # Create property
      [id].tsx                 # Property dashboard
      [id]/                    # Property detail routes
        photos/
        spaces/
        assignments/
        reports/
    inspections/               # Inspections tab
    insights/                  # Insights tab
    profile.tsx                # Profile tab

src/
  components/                  # Reusable UI components (PRG*)
  screens/                      # Screen components (used in property dashboard)
  services/                     # Business logic & API clients
    backendClient.ts           # Canonical Firebase Functions client
    propertiesService.ts        # Property operations
    spacesService.ts            # Space operations
    photosService.ts            # Photo operations
    photoUploadService.ts       # Photo upload pipeline (HEIC conversion, etc.)
    assignmentsService.ts       # Photo-space assignments
    inspectionsService.ts      # Inspection operations
    reportsService.ts           # Report operations
    directus.ts                 # Directus client (CMS content only)
    firebase.ts                 # Firebase Auth initialization
    storage.ts                  # Secure storage wrapper
  state/                        # Zustand stores
    authStore.ts                # Authentication state
    appStore.ts                 # Mock data (dev-only, deprecated)
  theme/                        # Design system
    colors.ts                   # Color palette
    typography.ts               # Typography system
    spacing.ts                  # Spacing scale
    useTheme.ts                 # Theme hook (light/dark/auto)
  types/                        # TypeScript type definitions
  utils/                        # Utility functions
    directusDate.ts             # Date formatting
    fileUrl.ts                  # File URL generation
    errorHandler.ts             # Error handling utilities
    validation.ts               # Form validation
  navigation/                   # Navigation utilities
    navIcon.ts                  # Tab bar icon mapping
    routes.ts                   # Route constants
```

## Core Workflows

### Authentication Flow

1. User signs up/logs in → Firebase Authentication
2. Firebase returns ID token → Stored in secure storage
3. App bootstraps `app_profile` in Directus (creates if doesn't exist)
4. User authenticated → Redirected to properties list

**Files:**
- `app/(auth)/login.tsx`, `app/(auth)/signup.tsx` - UI
- `src/state/authStore.ts` - Auth state management
- `src/services/firebase.ts` - Firebase Auth
- `src/services/backendClient.ts` - Profile bootstrap

### Properties Flow

1. User creates property → `propertiesService.createProperty()`
2. Service calls Firebase Function `createProperty`
3. Function validates user, creates property in Directus with `app_profile_id`
4. Returns property → UI updates

**Files:**
- `app/(tabs)/properties/create.tsx` - Create form
- `src/services/propertiesService.ts` - Property operations
- `src/services/backendClient.ts` - Firebase Functions client

### Photo Upload Flow

1. User selects/captures image → `expo-image-picker`
2. **Web + HEIC:** Detects HEIC → converts to JPEG via `photoUploadService`
3. Converts to base64 → `photoUploadService.processImageForUpload()`
4. Uploads to Firebase Function `uploadFile` → Directus storage
5. Creates photo record → `photosService.createPhoto()`
6. If uploading from space screen → auto-assigns to space

**Files:**
- `app/(tabs)/properties/[id]/photos/upload.tsx` - Upload UI
- `src/services/photoUploadService.ts` - Upload pipeline (HEIC conversion, base64)
- `src/services/photosService.ts` - Photo operations

### Spaces Flow

1. User creates space → `spacesService.createSpace()`
2. Service calls Firebase Function `createSpace`
3. Function verifies property ownership, creates space in Directus
4. Returns space → UI updates

**Files:**
- `app/(tabs)/properties/[id]/spaces/create.tsx` - Create form
- `src/services/spacesService.ts` - Space operations

### Inspection Flow

1. User starts inspection → `inspectionsService.createInspection()`
2. Firebase Function creates inspection + all 7 steps server-side
3. User navigates through steps → `inspectionsService.updateInspectionStep()`
4. Progress tracked → `inspectionsService.updateInspection()`
5. When complete → `inspection_status: 'completed'`

**Files:**
- `app/(tabs)/inspections/new.tsx` - Start inspection
- `app/(tabs)/inspections/[id].tsx` - Inspection wizard
- `src/services/inspectionsService.ts` - Inspection operations

## Backend Overview

### Firebase Functions → Directus

All user-owned data operations go through Firebase Functions:

1. Client sends request with Firebase ID token
2. Firebase Function verifies user authentication
3. Function looks up user's `app_profile_id` (or creates it)
4. Function performs Directus operation with ownership enforcement
5. Function returns data to client

**Benefits:**
- Ownership enforcement (all data filtered by `app_profile_id`)
- Security (Directus credentials never exposed to client)
- Consistency (single source of truth for business logic)

**Firebase Functions:**
- `bootstrapProfile` - Creates/gets user's `app_profile_id`
- `getMyProperties` - Gets user's properties
- `createProperty` - Creates property with ownership
- `getSpaces` - Gets spaces for user's property
- `createSpace` - Creates space with ownership verification
- `uploadFile` - Uploads file to Directus
- `createPhoto` - Creates photo with ownership
- `getPhotos` - Gets photos for user's property
- `createAssignment` - Assigns photo to space
- `createInspection` - Creates inspection + steps
- `getReports` - Gets reports for user's property
- And more...

**Directus Collections:**
- `properties` - Property entities
- `spaces` - Space entities
- `photos` - Photo entities
- `reports` - Report entities
- `inspections` - Inspection entities
- `inspection_steps` - Inspection step entities
- `app_profiles` - User profiles (links Firebase → Directus)
- `user_preferences` - User settings
- `disclaimer_blocks` - Public CMS content
- `jurisdiction_context` - Public CMS content

## MVP Status

### ✅ Done

- Authentication (Email/Password, Google Sign-In)
- Properties management (List, Create, View, Update, Delete)
- Spaces management (List, Create, View, Update, Delete)
- Photo upload and gallery (with HEIC conversion on web)
- Photo assignment to spaces
- Report generation and archive
- User preferences (theme)
- Guided inspection flow (creation and step management)

### ⚠️ Partial

- Guided inspection wizard (backend exists, frontend may be incomplete)
- Photo notes (data model exists, UI may be incomplete)

### ❌ Not Started

- AI-powered space suggestions
- Condition analysis
- PDF report generation (backend may exist, frontend viewing unclear)

## Where Things Live

### UI Components
- **Location:** `src/components/`
- **Pattern:** PRG* components (PRGButton, PRGInput, PRGCard, etc.)
- **Usage:** Imported in screens and route components

### Screen Components
- **Location:** `src/screens/`
- **Usage:** Used within property dashboard tabs (PropertyOverview, PropertySpaces, PropertyPhotos, PropertyReport)

### Route Screens
- **Location:** `app/`
- **Pattern:** File-based routing (Expo Router)
- **Structure:** `(auth)/` for auth flow, `(tabs)/` for main app

### Business Logic
- **Location:** `src/services/`
- **Pattern:** Domain services (propertiesService, spacesService, etc.)
- **All user-owned data:** Goes through Firebase Functions via `backendClient`

### State Management
- **Location:** `src/state/`
- **Library:** Zustand
- **Stores:** `authStore` (active), `appStore` (mock/dev-only)

### Navigation
- **Location:** `src/navigation/`
- **Files:** `navIcon.ts` (tab icons), `routes.ts` (route constants)

### Utilities
- **Location:** `src/utils/`
- **Files:** `directusDate.ts`, `fileUrl.ts`, `errorHandler.ts`, `validation.ts`

### Design System
- **Location:** `src/theme/`
- **Usage:** Import individual tokens (`colors`, `typography`, `spacing`) or use `useTheme()` hook

## Troubleshooting

### App won't start
- Check environment variables are set (especially Firebase config)
- Run `npm run verify-setup` to check configuration
- Clear Expo cache: `npx expo start -c`

### Authentication fails
- Verify Firebase configuration in `.env`
- Check Firebase project is active
- Ensure Firebase Authentication is enabled in Firebase Console

### Photos won't upload
- Check file size (may be too large)
- On web: HEIC conversion requires WebAssembly support
- Verify `EXPO_PUBLIC_DIRECTUS_URL` is set (or app is in mock mode)
- Check Firebase Functions are deployed

### Data not loading
- Verify Firebase Functions are deployed and accessible
- Check network connectivity
- Verify user is authenticated (`app_profile` may need bootstrap)
- Check browser console for errors

### Theme not working
- Verify `userPreferencesService` is working
- Check `useTheme()` hook is used in components
- System theme detection requires platform support

### Navigation issues
- Use route constants from `src/navigation/routes.ts`
- Check route paths match Expo Router file structure
- Verify params are passed correctly

## Mock Mode

If `EXPO_PUBLIC_DIRECTUS_URL` is not set, the app runs in **mock mode**:
- Uses mock data from `src/state/appStore.ts` (deprecated, dev-only)
- Directus client returns mock responses
- Allows development without backend connection
- **Note:** Mock mode is for development only, not production-ready

## Design System

- **Primary Color**: #6F00FF
- **Dark Background**: #191414
- **Light Background**: #FFFFFF
- **Typography**: System fonts (San Francisco on iOS, Roboto on Android)
- **Theme Support**: Light, Dark, Auto (system)
- **Style**: Clean, professional, high-trust visual design

## Next Steps (Phase 2)

- AI-powered space suggestions
- Condition analysis
- PDF report generation
- Enhanced photo metadata extraction

## Daily Maintenance

This repository follows a daily "safe cleanup" routine to maintain code quality and consistency. The cleanup process focuses on:

1. **Repo hygiene** - Remove unused files, dead code, and temporary debug scripts
2. **Code quality** - Fix formatting, remove duplication, normalize patterns
3. **Documentation** - Keep README.md and docs aligned with the codebase

### Cleanup Routine

Follow these steps in order:

#### A) Repo Hygiene and Consistency
- Identify and remove unused files, unused exports, and dead code paths
- Remove temporary debug scripts (e.g., `find-file-ids.js`, `get-token.js`)
- Ensure consistent folder structure (group by feature/domain where applicable)
- Standardize naming conventions already used in the repo

#### B) Code Quality Improvements (Safe Refactors Only)
- Remove obvious duplication (extract small helpers/utilities) when it reduces repeated logic without changing behavior
- Improve type safety/guards where applicable (but do not rewrite large modules)
- Normalize error handling: consistent try/catch patterns, consistent user-safe error messages, consistent logging
- Ensure service/client modules follow the project's established pattern

#### C) Lint/Format/Build Health
- Run lint/format commands if present (or apply formatting consistent with existing config)
- Fix lint errors that are clearly safe
- Fix import order/unused imports across the project
- Confirm the app compiles/builds (use `npm start` or platform-specific scripts)

#### D) Documentation Update
- Update README.md to reflect the cleaned codebase
- Ensure "Daily Maintenance" section matches current workflow
- Reference CODINGRULES.md for coding standards

### Safety Rules

**NON-NEGOTIABLE:**
- Do NOT change product behavior, backend contracts, API routes, Directus schema expectations, authentication flows, or navigation logic unless it is broken today
- Do NOT add new features. Cleanup only.
- Do NOT change any environment variable names or required secrets
- Do NOT rename any public API endpoints, Directus collection names, or Firebase Function names
- Avoid "big bang" refactors. Prefer small, mechanical changes
- If a change could be risky, skip it and leave a TODO comment

### Coding Rules

See [CODINGRULES.md](./docs/CODINGRULES.md) for detailed coding standards and architectural guidelines. All code changes must follow these rules to maintain consistency and prevent regressions.

### Recent Cleanup (Latest Pass)

**Hygiene:**
- Removed temporary debug scripts: `find-file-ids.js`, `get-test-url.js`, `get-token.js`, `test-getfile-function.js`
- Cleaned up trailing whitespace in index files (`src/components/index.ts`, `src/services/index.ts`, `src/screens/index.ts`)
- Fixed formatting inconsistencies (indentation, blank lines)

**Code Quality:**
- Verified all exports in index.ts files are used
- Fixed minor indentation issues in route files
- Confirmed error handling utilities exist (`src/utils/errorHandler.ts`) - note: not all files use them yet (future improvement)

**Documentation:**
- Updated README.md with daily maintenance section
- Aligned README structure with current codebase

**Risk Notes / Skipped Items:**
- Error handling normalization: While `errorHandler.ts` exists, normalizing all error handling across the codebase would be a large refactor. This is documented for future improvement.
- `appStore.ts`: Marked as deprecated but kept for mock mode compatibility. Not actively used in production code.

