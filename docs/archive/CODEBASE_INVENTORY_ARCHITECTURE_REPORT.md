# Codebase Inventory + Architecture Report
## Project Renter Guardian

**Generated:** 2025-01-27  
**Status:** Read-only analysis - no code modifications made

---

## 0) App Snapshot

### App Name
**Renter Guardian** (slug: `renter-guardian`)

### Platforms
- **iOS** (supports tablet)
- **Android**
- **Web** (via Expo web bundler)

### Framework Stack
- **Expo** ~51.0.0
- **React Native** 0.74.0
- **React** 18.2.0
- **TypeScript** ~5.3.0
- **Expo Router** ~3.5.0 (file-based routing)
- **Zustand** ^4.5.0 (state management)

### Local Development Commands
```bash
npm start          # Start Expo dev server
npm run android    # Start with Android emulator
npm run ios        # Start with iOS simulator
npm run web        # Start web version
npm run setup-assets    # Create placeholder assets
npm run verify-setup    # Verify configuration
```

### High-Level Feature Status

**✅ Implemented:**
- Authentication (Email/Password, Google Sign-In)
- Properties management (List, Create, View, Update, Delete)
- Spaces management (List, Create, View, Update, Delete)
- Photo upload and gallery (with HEIC conversion on web)
- Photo assignment to spaces
- Report generation and archive
- User preferences (theme)
- Guided inspection flow (partial - inspection creation and step management)

**⚠️ Partially Implemented:**
- Guided inspection wizard (backend exists, frontend screens may be incomplete)
- Photo notes (data model exists, UI may be incomplete)

**❌ Not Implemented:**
- AI-powered space suggestions
- Condition analysis
- PDF report generation (backend may exist, frontend viewing unclear)

---

## 1) Repository Tree

```
ProjectRenterGuardian/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx              # Root layout (auth check, theme setup)
│   ├── index.tsx                # Root redirect (auth → tabs, unauthenticated → login)
│   ├── (auth)/                  # Authentication group
│   │   ├── _layout.tsx         # Auth stack layout
│   │   ├── login.tsx           # Login screen
│   │   └── signup.tsx          # Sign up screen
│   └── (tabs)/                  # Main app tabs group
│       ├── _layout.tsx         # Tab bar layout (4 tabs: properties, inspections, insights, profile)
│       ├── properties/         # Properties tab
│       │   ├── _layout.tsx
│       │   ├── index.tsx        # Properties list
│       │   ├── create.tsx       # Create property form
│       │   ├── [id].tsx         # Property dashboard (tabs: overview, spaces, photos, report)
│       │   └── [id]/            # Property detail routes
│       │       ├── photos/
│       │       │   ├── upload.tsx
│       │       │   └── [photoId].tsx
│       │       ├── spaces/
│       │       │   ├── create.tsx
│       │       │   └── [spaceId].tsx
│       │       ├── assignments/
│       │       │   └── bulk.tsx
│       │       └── reports/
│       │           └── [reportId].tsx
│       ├── inspections/         # Inspections tab
│       │   ├── _layout.tsx
│       │   ├── index.tsx        # Inspections list
│       │   ├── new.tsx          # New inspection start
│       │   └── [id].tsx         # Inspection wizard (guided flow)
│       ├── insights/             # Insights tab
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── profile.tsx          # Profile tab
│
├── src/                          # Application source code
│   ├── components/              # Reusable UI components
│   │   ├── DateField/           # Date picker component
│   │   ├── PRGBadge.tsx
│   │   ├── PRGButton.tsx
│   │   ├── PRGCard.tsx
│   │   ├── PRGDisclaimerBlock.tsx
│   │   ├── PRGEditableTextRow.tsx
│   │   ├── PRGEmptyState.tsx
│   │   ├── PRGHeader.tsx
│   │   ├── PRGInput.tsx
│   │   ├── PRGLoadingOverlay.tsx
│   │   ├── PRGPhotoGrid.tsx
│   │   ├── PRGTabBar.tsx
│   │   ├── PRGToast.tsx
│   │   ├── PRGToastProvider.tsx
│   │   ├── ScreenContainer.tsx
│   │   ├── SVGIcon.tsx
│   │   └── index.ts             # Component exports
│   │
│   ├── screens/                  # Screen components (used by property dashboard)
│   │   ├── PropertyAssignments.tsx
│   │   ├── PropertyOverview.tsx
│   │   ├── PropertyPhotos.tsx
│   │   ├── PropertyReport.tsx
│   │   ├── PropertySpaces.tsx
│   │   └── index.ts
│   │
│   ├── services/                 # API clients and business logic
│   │   ├── assignmentsService.ts
│   │   ├── backend.ts             # Legacy backend service (deprecated)
│   │   ├── backendClient.ts      # Firebase Functions client (canonical)
│   │   ├── directus.ts           # Directus REST client (deprecated for user data)
│   │   ├── firebase.ts           # Firebase Auth initialization
│   │   ├── googleAuth.ts         # Google Sign-In implementation
│   │   ├── inspectionsService.ts
│   │   ├── photosService.ts
│   │   ├── propertiesService.ts
│   │   ├── reportsService.ts
│   │   ├── spacesService.ts
│   │   ├── storage.ts            # Secure storage (Expo SecureStore / localStorage)
│   │   ├── userPreferencesService.ts
│   │   └── index.ts              # Service exports
│   │
│   ├── state/                     # Zustand state stores
│   │   ├── appStore.ts           # Mock data store (unused in production)
│   │   └── authStore.ts          # Authentication state
│   │
│   ├── theme/                     # Design system
│   │   ├── colors.ts
│   │   ├── fonts.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   ├── useTheme.ts           # Theme hook (light/dark/auto)
│   │   └── index.ts
│   │
│   ├── types/                     # TypeScript type definitions
│   │   └── index.ts               # All entity types (Property, Space, Photo, etc.)
│   │
│   ├── utils/                     # Utility functions
│   │   ├── deviceDetection.ts
│   │   ├── directusDate.ts       # Date formatting utilities
│   │   └── fileUrl.ts            # Directus file URL generation
│   │
│   └── navigation/                # Navigation utilities
│       └── navIcon.ts             # Tab bar icon mapping
│
├── functions/                     # Firebase Functions (backend)
│   ├── src/
│   │   └── index.ts               # Cloud Functions implementation
│   ├── package.json
│   └── tsconfig.json
│
├── assets/                        # Static assets
│   ├── nav_bar_symbols/          # Tab bar icons (old)
│   ├── nav_bar_symbols_final/    # Tab bar icons (current)
│   └── *.png.placeholder         # Placeholder images
│
├── scripts/                       # Build/setup scripts
│   ├── create-placeholder-assets.js
│   └── verify-setup.js
│
├── app.json                       # Expo configuration
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── babel.config.js                # Babel configuration (module resolver)
├── metro.config.js                # Metro bundler config (SVG transformer)
│
└── *.md                           # Documentation files
```

### Notable Configuration Files
- **`app.json`**: Expo app configuration (name, slug, icons, platforms)
- **`tsconfig.json`**: TypeScript paths (`@/*` → `./src/*`)
- **`babel.config.js`**: Module resolver for `@/` imports
- **`metro.config.js`**: SVG transformer configuration
- **`functions/package.json`**: Firebase Functions dependencies

---

## 2) Architecture Map

### UI Layer (Screens/Pages/Components)

**Location:** `app/` (Expo Router) + `src/screens/` + `src/components/`

**Structure:**
- **Route-based screens:** `app/(tabs)/*` and `app/(auth)/*` (file-based routing)
- **Reusable components:** `src/components/*` (PRG* components)
- **Screen components:** `src/screens/*` (used within property dashboard tabs)

**Key Files:**
- `app/_layout.tsx` - Root layout with auth check
- `app/(tabs)/_layout.tsx` - Tab bar configuration
- `app/(tabs)/properties/index.tsx` - Properties list
- `app/(tabs)/properties/[id].tsx` - Property dashboard with internal tabs
- `src/components/PRG*.tsx` - Design system components
- `src/screens/Property*.tsx` - Property detail screen components

### Navigation/Routing Layer

**Location:** `app/` (Expo Router file-based routing)

**Structure:**
- File-based routing via Expo Router
- Stack navigation for auth flow
- Tab navigation for main app
- Internal tab navigation within property detail screen

**Key Files:**
- `app/_layout.tsx` - Root Stack navigator
- `app/(auth)/_layout.tsx` - Auth Stack
- `app/(tabs)/_layout.tsx` - Tab navigator (4 tabs)
- `src/navigation/navIcon.ts` - Tab bar icon mapping

### State Management Layer

**Location:** `src/state/`

**Library:** Zustand ^4.5.0

**Stores:**
1. **`authStore.ts`** - Authentication state
   - `isAuthenticated`, `user`, `isLoading`
   - Actions: `login`, `register`, `signInWithGoogle`, `logout`, `checkAuth`
   - Persists to secure storage

2. **`appStore.ts`** - Mock data store (⚠️ **UNUSED IN PRODUCTION**)
   - Contains mock properties/spaces/photos
   - Only used if Directus URL not configured
   - Should be removed or clearly marked as dev-only

**Key Files:**
- `src/state/authStore.ts` - Auth state management
- `src/state/appStore.ts` - Mock data (deprecated)

### Data Layer

**Location:** `src/services/`

**Architecture:** Hybrid backend
- **Firebase Authentication** - User auth (via `firebase.ts`)
- **Firebase Functions** - Backend API (via `backendClient.ts`)
- **Directus CMS** - Data storage (accessed via Firebase Functions, NOT directly)

**Service Pattern:**
- Domain services (`propertiesService`, `spacesService`, `photosService`, etc.)
- All user-owned data goes through Firebase Functions
- Directus client (`directus.ts`) is **deprecated** for user data (marked with warnings)
- Directus only used for public CMS content (disclaimers, jurisdiction context)

**Key Files:**
- `src/services/backendClient.ts` - **Canonical** Firebase Functions client
- `src/services/firebase.ts` - Firebase Auth initialization
- `src/services/directus.ts` - Directus client (deprecated for user data)
- `src/services/propertiesService.ts` - Property operations
- `src/services/spacesService.ts` - Space operations
- `src/services/photosService.ts` - Photo operations
- `src/services/assignmentsService.ts` - Photo-space assignments
- `src/services/inspectionsService.ts` - Inspection operations
- `src/services/reportsService.ts` - Report operations
- `src/services/userPreferencesService.ts` - User preferences
- `src/services/storage.ts` - Secure storage wrapper

### Domain Models/Types

**Location:** `src/types/index.ts`

**Entities Defined:**
- `Property` - Property entity
- `Space` - Room/space entity
- `Photo` - Photo entity
- `PhotoSpaceAssignment` - Photo-to-space mapping
- `Report` - Move-in report
- `DisclaimerBlock` - Legal disclaimers
- `JurisdictionContext` - State-specific content
- `DirectusFile` - File metadata
- `AppProfile` - User profile (links Firebase user to Directus)
- `Inspection` - Inspection entity
- `InspectionStep` - Inspection step entity
- `UserPreferences` - User preferences

**Key File:**
- `src/types/index.ts` - All TypeScript interfaces

### Utilities/Helpers

**Location:** `src/utils/`

**Utilities:**
- `directusDate.ts` - Date formatting (ISO 8601 conversion, display formatting)
- `fileUrl.ts` - Directus file URL generation (with auth token)
- `deviceDetection.ts` - Platform detection

**Key Files:**
- `src/utils/directusDate.ts` - Date utilities
- `src/utils/fileUrl.ts` - File URL generation
- `src/utils/deviceDetection.ts` - Device/platform detection

### Styling/Theme System

**Location:** `src/theme/`

**Structure:**
- Design tokens (colors, typography, spacing)
- Theme hook (`useTheme`) for light/dark/auto mode
- System fonts (San Francisco / Roboto)

**Key Files:**
- `src/theme/colors.ts` - Color palette
- `src/theme/typography.ts` - Typography system
- `src/theme/spacing.ts` - Spacing scale
- `src/theme/fonts.ts` - Font configuration
- `src/theme/useTheme.ts` - Theme hook (reads user preferences)

---

## 3) Runtime Flows (Step-by-Step Call Chains)

### Sign Up / Login / Auth Persistence

**Entry Point:** `app/(auth)/login.tsx` or `app/(auth)/signup.tsx`

**Login Flow (Email/Password):**
1. User enters email/password → `app/(auth)/login.tsx` → `handleLogin()`
2. Calls `useAuthStore().login(email, password)`
3. `src/state/authStore.ts` → `login()` action
4. Calls `firebaseAuth.signInWithEmail(email, password)` → `src/services/firebase.ts`
5. Firebase Auth returns user + token
6. Stores token via `storage.setToken(token)` → `src/services/storage.ts`
7. Stores user via `storage.setUser(user)`
8. Updates Zustand state: `set({ isAuthenticated: true, user })`
9. Bootstraps profile: `backend.bootstrapProfile()` → `src/services/backend.ts` → `backendClient.bootstrapProfile()` → Firebase Function `bootstrapProfile`
10. Redirects: `router.replace('/(tabs)/properties')`

**Google Sign-In Flow:**
1. User clicks "Sign in with Google" → `app/(auth)/login.tsx` → `handleGoogleSignIn()`
2. Calls `useAuthStore().signInWithGoogle()`
3. `src/state/authStore.ts` → `signInWithGoogle()` action
4. Dynamically imports `signInWithGoogle()` → `src/services/googleAuth.ts`
5. **Web:** Uses `signInWithPopup()` (fallback to `signInWithRedirect()`)
6. Firebase Auth returns user + token
7. Stores token/user (same as email flow)
8. Bootstraps profile (same as email flow)
9. Redirects to properties

**Auth Persistence:**
1. App starts → `app/_layout.tsx` → `useEffect()` → `checkAuth()`
2. `src/state/authStore.ts` → `checkAuth()` action
3. Checks `firebaseAuth.getCurrentUser()` → `src/services/firebase.ts`
4. If user exists: gets fresh token, stores it, updates state
5. If no user: falls back to `storage.getToken()` / `storage.getUser()`
6. Sets `isLoading: false` to render UI

**Error Handling:**
- Login errors caught in `try/catch` → displayed via `setError()` in UI
- Google redirect errors handled in `checkGoogleRedirect()` → `app/_layout.tsx`
- Profile bootstrap errors logged but don't fail auth

### Create Property

**Entry Point:** `app/(tabs)/properties/create.tsx`

**Flow:**
1. User fills form → `app/(tabs)/properties/create.tsx` → `handleCreate()`
2. Validates required fields (address, lease start date)
3. Calls `propertiesService.createProperty(input)` → `src/services/propertiesService.ts`
4. `propertiesService.createProperty()` → `backendClient.call('createProperty', ...)` → `src/services/backendClient.ts`
5. `backendClient.request()` → Gets Firebase ID token → `getIdToken()` → `src/services/firebase.ts`
6. Makes authenticated POST to Firebase Function: `https://us-central1-{projectId}.cloudfunctions.net/createProperty`
7. Firebase Function validates user, creates property in Directus with `app_profile_id`
8. Returns property data
9. Shows success toast: `showToast('Property created', 'success')` → `src/components/PRGToastProvider.tsx`
10. Navigates: `router.replace('/(tabs)/properties/${property.id}')`

**Error Handling:**
- Validation errors: `setError()` displayed in UI
- API errors: caught in `try/catch` → `showToast('Failed to create property', 'error')`
- Backend errors throw `BackendError` with status code → `src/services/backendClient.ts`

### Create Space

**Entry Point:** `app/(tabs)/properties/[id]/spaces/create.tsx` (inferred, not read)

**Flow:**
1. User fills space form → calls `spacesService.createSpace(input)` → `src/services/spacesService.ts`
2. `spacesService.createSpace()` → `backendClient.call('createSpace', ...)` → `src/services/backendClient.ts`
3. Authenticated POST to Firebase Function: `createSpace`
4. Firebase Function verifies property ownership, creates space in Directus
5. Returns space data
6. Shows success toast
7. Navigates back to property spaces tab

**Error Handling:**
- Similar to property creation (toast on error)

### Attach/Upload Photos

**Entry Point:** `app/(tabs)/properties/[id]/photos/upload.tsx`

**Flow:**
1. User selects "Pick from Library" or "Take Photo" → `handlePickImages()` or `handleTakePhoto()`
2. Requests permissions: `ImagePicker.requestMediaLibraryPermissionsAsync()` or `requestCameraPermissionsAsync()`
3. Launches picker: `ImagePicker.launchImageLibraryAsync()` or `launchCameraAsync()` → `expo-image-picker`
4. User selects/captures images → `uploadPhotos(assets)`
5. **For each asset:**
   - **Web + HEIC:** Detects HEIC → loads `heic2any` → converts to JPEG → `convertHeicToJpeg()`
   - **Native:** Uses `preferredAssetRepresentationMode: Compatible` (iOS converts automatically)
   - Converts to base64: `FileSystem.readAsStringAsync(asset.uri, { encoding: Base64 })`
6. Creates file object: `{ base64, type: mimeType, name: fileName }`
7. Calls `photosService.uploadFile(file)` → `src/services/photosService.ts`
8. `photosService.uploadFile()` → `backendClient.call('uploadFile', ...)` → Firebase Function `uploadFile`
9. Firebase Function uploads to Directus `/files` endpoint, returns file ID
10. Creates photo record: `photosService.createPhoto(photoData)` → Firebase Function `createPhoto`
11. If `spaceId` provided (uploading from space screen): sets `space` and `assignment_status: 'confirmed'`
12. Updates upload progress: `setUploads(prev => ...)`
13. Shows success toast: `showToast('${count} photo(s) uploaded', 'success')`
14. Navigates back: `router.replace('/(tabs)/properties/${id}')` or to space if `spaceId` provided

**Error Handling:**
- Permission errors: `alert()` displayed
- HEIC conversion errors: throws error with message → displayed in toast
- Upload errors: caught in `try/catch` → `showToast('Failed to upload photos', 'error')` → updates upload status to 'error'
- Network errors: handled by `BackendError` → displayed in toast

### Assign Photo to Property/Space

**Entry Point:** `app/(tabs)/properties/[id]/photos/[photoId].tsx` or `app/(tabs)/properties/[id]/assignments/bulk.tsx` (inferred)

**Flow:**
1. User selects photo(s) and space → calls `assignmentsService.createAssignment(photoId, spaceId)` → `src/services/assignmentsService.ts`
2. `assignmentsService.createAssignment()` → `backendClient.call('createAssignment', ...)` → Firebase Function `createAssignment`
3. Firebase Function verifies property ownership, creates `photo_space_assignments` record
4. Updates photo `assignment_status` to 'confirmed' (handled server-side)
5. Returns assignment data
6. Shows success toast
7. Refreshes photo list

**Error Handling:**
- Similar to other operations (toast on error)

### Add/Edit Notes for a Photo

**Entry Point:** `app/(tabs)/properties/[id]/photos/[photoId].tsx` (inferred, not read)

**Flow:**
1. User edits notes field → calls `photosService.updatePhoto(photoId, { notes: newNotes })` → `src/services/photosService.ts`
2. `photosService.updatePhoto()` → `backendClient.call('updatePhoto', ...)` → Firebase Function `updatePhoto`
3. Firebase Function verifies ownership, updates photo record in Directus
4. Returns updated photo
5. Shows success toast
6. Updates local state

**Error Handling:**
- Similar to other operations

### Guided Inspection Flow

**Entry Point:** `app/(tabs)/inspections/new.tsx`

**Create Inspection:**
1. User selects property and inspection type → `handleStart()`
2. Calls `inspectionsService.createInspection({ property_id, inspection_type })` → `src/services/inspectionsService.ts`
3. `inspectionsService.createInspection()` → `backendClient.call('createInspection', ...)` → Firebase Function `createInspection`
4. Firebase Function creates inspection + all 7 steps server-side
5. Returns inspection data
6. Navigates: `router.replace('/(tabs)/inspections/${inspection.id}')`

**Inspection Wizard (Step-by-Step):**
1. User navigates to `app/(tabs)/inspections/[id].tsx` (inferred, not read)
2. Loads inspection: `inspectionsService.getInspection(id)`
3. Loads steps: `inspectionsService.getInspectionSteps(inspectionId)`
4. Determines current step from `inspection.last_step` or `inspection_step_status`
5. Renders current step UI
6. User completes step → calls `inspectionsService.updateInspectionStep(stepId, { payload_json, inspection_step_status: 'completed' })`
7. Updates inspection progress: `inspectionsService.updateInspection(inspectionId, { last_step, inspections_progress, inspection_status })`
8. Moves to next step
9. When all steps complete: sets `inspection_status: 'completed'`, `completed_at: now`

**Error Handling:**
- Similar to other operations (toast on error)

---

## 4) Data Model + API Contract Inventory

### Entity: Property

**Type Definition:** `src/types/index.ts` → `Property` interface

**Fields:**
- `id: string` - Directus UUID
- `app_profile_id: string` - Links to user profile (enforced server-side)
- `address_free_text: string` - Full address
- `lease_start_date: string` - ISO 8601 date
- `lease_end_date?: string` - ISO 8601 date (optional)
- `nickname?: string` - User-friendly name
- `state_code?: string` - 2-letter state code
- `status?: string` - 'active' | 'draft' | 'archived' (inferred from UI)
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `properties`

**API Methods:**
- `propertiesService.getMyProperties()` → Firebase Function `getMyProperties` (GET) → Returns `{ data: Property[] }`
- `propertiesService.createProperty(input)` → Firebase Function `createProperty` (POST) → Returns `{ data: Property }`
- `propertiesService.getProperty(id)` → Firebase Function `getProperty?id={id}` (GET) → Returns `{ data: Property }`
- `propertiesService.updateProperty(id, updates)` → Firebase Function `updateProperty` (PATCH) → Returns `{ data: Property }`
- `propertiesService.deleteProperty(id)` → Firebase Function `deleteProperty` (DELETE) → Returns `{ ok: boolean, message: string }`

**Naming Consistency:** ✅ Consistent (snake_case in types, matches Directus)

### Entity: Space

**Type Definition:** `src/types/index.ts` → `Space` interface

**Fields:**
- `id: string` - Directus UUID
- `property: string` - Property ID (foreign key)
- `space_type: 'living_room' | 'kitchen' | 'hallway' | 'bedroom' | 'bathroom' | 'garage' | 'dining_room' | 'custom_space_type'`
- `display_name: string` - User-visible name
- `custom_space_type?: string` - Custom type name (when `space_type` is 'custom_space_type', max 255 chars)
- `ordinal?: number` - Sort order
- `is_default?: boolean` - Default space flag
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `spaces`

**API Methods:**
- `spacesService.getSpaces(propertyId)` → Firebase Function `getSpaces?propertyId={id}` (GET) → Returns `{ data: Space[] }`
- `spacesService.createSpace(input)` → Firebase Function `createSpace` (POST) → Returns `{ data: Space }`
- `spacesService.updateSpace(spaceId, updates)` → Firebase Function `updateSpace` (PATCH) → Returns `{ data: Space }`
- `spacesService.deleteSpace(spaceId)` → Firebase Function `deleteSpace` (DELETE) → Returns `{ ok: boolean, message: string }`

**Naming Consistency:** ✅ Consistent (snake_case)

### Entity: Photo

**Type Definition:** `src/types/index.ts` → `Photo` interface

**Fields:**
- `id: string` - Directus UUID
- `property: string` - Property ID (foreign key)
- `space: string` - Space ID (required in Directus, may be default space)
- `file: string` - Directus file ID (foreign key to `directus_files`)
- `captured_at: string` - ISO 8601 datetime (EXIF or upload time)
- `exif_datetime_original?: string` - EXIF datetime (optional)
- `assignment_status: 'unassigned' | 'confirmed'` - Assignment status
- `notes?: string` - User notes (optional)
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `photos`

**API Methods:**
- `photosService.getPhotos(propertyId, filters?)` → Firebase Function `getPhotos?propertyId={id}&status={status}&spaceId={spaceId}` (GET) → Returns `{ data: Photo[] }`
- `photosService.getPhoto(photoId)` → Firebase Function `getPhoto?photoId={id}` (GET) → Returns `{ data: Photo }`
- `photosService.createPhoto(data)` → Firebase Function `createPhoto` (POST) → Returns `{ data: Photo }`
- `photosService.updatePhoto(photoId, updates)` → Firebase Function `updatePhoto` (PATCH) → Returns `{ data: Photo }`
- `photosService.deletePhoto(photoId)` → Firebase Function `deletePhoto` (POST) → Returns `{ ok: boolean, message?: string }`
- `photosService.uploadFile(file)` → Firebase Function `uploadFile` (POST) → Returns `{ data: { id: string } }` (file ID)

**Naming Consistency:** ✅ Consistent (snake_case)

### Entity: PhotoSpaceAssignment

**Type Definition:** `src/types/index.ts` → `PhotoSpaceAssignment` interface

**Fields:**
- `id: string` - Directus UUID
- `photo: string` - Photo ID (foreign key)
- `space: string` - Space ID (foreign key)
- `status: 'confirmed'` - Assignment status
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `photo_space_assignments`

**API Methods:**
- `assignmentsService.getAssignments(photoId)` → Firebase Function `getAssignments?photoId={id}` (GET) → Returns `{ data: PhotoSpaceAssignment[] }`
- `assignmentsService.createAssignment(photoId, spaceId)` → Firebase Function `createAssignment` (POST) → Returns `{ data: PhotoSpaceAssignment }`
- `assignmentsService.updateAssignment(assignmentId, updates)` → Firebase Function `updateAssignment` (PATCH) → Returns `{ data: PhotoSpaceAssignment }`
- `assignmentsService.deleteAssignment(assignmentId)` → Firebase Function `deleteAssignment` (DELETE) → Returns `{}`

**Naming Consistency:** ✅ Consistent (snake_case)

### Entity: Report

**Type Definition:** `src/types/index.ts` → `Report` interface

**Fields:**
- `id: string` - Directus UUID
- `property: string` - Property ID (foreign key)
- `snapshot_json?: any` - Report snapshot data (JSON)
- `status: 'draft' | 'generating' | 'ready' | 'failed'` - Report status
- `pdf_file?: string` - Directus file ID for PDF (optional)
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `reports`

**API Methods:**
- `reportsService.getReports(propertyId)` → Firebase Function `getReports?propertyId={id}` (GET) → Returns `{ data: Report[] }`
- `reportsService.getReport(id)` → Firebase Function `getReportById?id={id}` (GET) → Returns `{ data: Report }`
- `reportsService.createReport(input)` → Firebase Function `createReport` (POST) → Returns `{ data: Report }`

**Naming Consistency:** ✅ Consistent (snake_case)

### Entity: Inspection

**Type Definition:** `src/types/index.ts` → `Inspection` interface

**Fields:**
- `id: string` - Directus UUID
- `property_id: string` - Property ID (⚠️ **INCONSISTENT:** uses `property_id` not `property`)
- `created_by_user_id: string` - User ID (inferred, not in type)
- `inspection_status: 'in_progress' | 'completed'` - Status
- `inspection_type: string` - Type (e.g., 'move_in', 'move_out')
- `started_at: string` - ISO 8601 datetime
- `completed_at?: string` - ISO 8601 datetime (optional)
- `last_step?: string | null` - Current step key (optional)
- `inspections_progress: number` - Progress 0-100
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `inspections`

**API Methods:**
- `inspectionsService.getMyInspections(filters?)` → Firebase Function `getInspections?status={status}` (GET) → Returns `{ data: Inspection[] }`
- `inspectionsService.getInspection(id)` → Firebase Function `getInspectionById?id={id}` (GET) → Returns `{ data: Inspection }`
- `inspectionsService.createInspection(input)` → Firebase Function `createInspection` (POST) → Returns `{ data: Inspection }`
- `inspectionsService.updateInspection(inspectionId, updates)` → Firebase Function `updateInspection` (PATCH) → Returns `{ data: Inspection }`

**Naming Inconsistency:** ⚠️ Uses `property_id` instead of `property` (inconsistent with other entities)

### Entity: InspectionStep

**Type Definition:** `src/types/index.ts` → `InspectionStep` interface

**Fields:**
- `id: string` - Directus UUID
- `inspection_id: string` - Inspection ID (foreign key)
- `step_key: string` - Step identifier (e.g., 'step_1', 'step_2')
- `inspection_step_status: 'not_started' | 'in_progress' | 'completed'` - Step status
- `payload_json?: any` - Step data (JSON)
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `inspection_steps` (inferred)

**API Methods:**
- `inspectionsService.getInspectionSteps(inspectionId)` → Firebase Function `getInspectionSteps?inspectionId={id}` (GET) → Returns `{ data: InspectionStep[] }`
- `inspectionsService.getInspectionStep(inspectionId, stepKey)` → Firebase Function `getInspectionStep?inspectionId={id}&stepKey={key}` (GET) → Returns `{ data: InspectionStep }`
- `inspectionsService.updateInspectionStep(stepId, updates)` → Firebase Function `updateInspectionStep` (PATCH) → Returns `{ data: InspectionStep }`

**Naming Inconsistency:** ⚠️ Uses `inspection_id` instead of `inspection` (inconsistent with other entities)

### Entity: UserPreferences

**Type Definition:** `src/types/index.ts` → `UserPreferences` interface

**Fields:**
- `id: string` - Directus UUID
- `app_profile_id: string` - User profile ID (foreign key)
- `theme_preference: 'light' | 'dark' | 'auto'` - Theme preference
- `date_created?: string` - ISO 8601 datetime
- `date_updated?: string` - ISO 8601 datetime

**Directus Collection:** `user_preferences` (inferred)

**API Methods:**
- `userPreferencesService.getUserPreferences()` → Firebase Function `getUserPreferences` (GET) → Returns `{ data: UserPreferences | null }`
- `userPreferencesService.updateUserPreferences(updates)` → Firebase Function `updateUserPreferences` (PATCH) → Returns `{ data: UserPreferences }`

**Naming Consistency:** ✅ Consistent (snake_case)

### Entity: AppProfile

**Type Definition:** `src/types/index.ts` → `AppProfile` interface (partial)

**Fields:**
- `id: string` - Directus UUID
- `directus_users_id: string` - Directus user ID (links to Firebase user)

**Directus Collection:** `app_profiles`

**API Methods:**
- `backendClient.bootstrapProfile()` → Firebase Function `bootstrapProfile` (POST) → Returns `{ app_profile_id: string }` (creates if doesn't exist)

**Note:** No direct service for app_profiles (only bootstrap)

### API Client Methods Summary

**File:** `src/services/backendClient.ts`
- `bootstrapProfile()` → POST `bootstrapProfile` → `{ app_profile_id: string }`
- `call<T>(functionName, options)` → Generic request method

**File:** `src/services/propertiesService.ts`
- `getMyProperties()` → GET `getMyProperties` → `{ data: Property[] }`
- `createProperty(input)` → POST `createProperty` → `{ data: Property }`
- `getProperty(id)` → GET `getProperty?id={id}` → `{ data: Property }`
- `updateProperty(id, updates)` → PATCH `updateProperty` → `{ data: Property }`
- `deleteProperty(id)` → DELETE `deleteProperty` → `{ ok: boolean, message: string }`

**File:** `src/services/spacesService.ts`
- `getSpaces(propertyId)` → GET `getSpaces?propertyId={id}` → `{ data: Space[] }`
- `createSpace(input)` → POST `createSpace` → `{ data: Space }`
- `updateSpace(spaceId, updates)` → PATCH `updateSpace` → `{ data: Space }`
- `deleteSpace(spaceId)` → DELETE `deleteSpace` → `{ ok: boolean, message: string }`

**File:** `src/services/photosService.ts`
- `getPhotos(propertyId, filters?)` → GET `getPhotos?propertyId={id}&status={status}&spaceId={spaceId}` → `{ data: Photo[] }`
- `getPhoto(photoId)` → GET `getPhoto?photoId={id}` → `{ data: Photo }`
- `createPhoto(data)` → POST `createPhoto` → `{ data: Photo }`
- `updatePhoto(photoId, updates)` → PATCH `updatePhoto` → `{ data: Photo }`
- `deletePhoto(photoId)` → POST `deletePhoto` → `{ ok: boolean, message?: string }`
- `uploadFile(file)` → POST `uploadFile` → `{ data: { id: string } }`

**File:** `src/services/assignmentsService.ts`
- `getAssignments(photoId)` → GET `getAssignments?photoId={id}` → `{ data: PhotoSpaceAssignment[] }`
- `createAssignment(photoId, spaceId)` → POST `createAssignment` → `{ data: PhotoSpaceAssignment }`
- `updateAssignment(assignmentId, updates)` → PATCH `updateAssignment` → `{ data: PhotoSpaceAssignment }`
- `deleteAssignment(assignmentId)` → DELETE `deleteAssignment` → `{}`

**File:** `src/services/inspectionsService.ts`
- `getMyInspections(filters?)` → GET `getInspections?status={status}` → `{ data: Inspection[] }`
- `getInspection(id)` → GET `getInspectionById?id={id}` → `{ data: Inspection }`
- `createInspection(input)` → POST `createInspection` → `{ data: Inspection }`
- `getInspectionSteps(inspectionId)` → GET `getInspectionSteps?inspectionId={id}` → `{ data: InspectionStep[] }`
- `getInspectionStep(inspectionId, stepKey)` → GET `getInspectionStep?inspectionId={id}&stepKey={key}` → `{ data: InspectionStep }`
- `updateInspectionStep(stepId, updates)` → PATCH `updateInspectionStep` → `{ data: InspectionStep }`
- `updateInspection(inspectionId, updates)` → PATCH `updateInspection` → `{ data: Inspection }`

**File:** `src/services/reportsService.ts`
- `getReports(propertyId)` → GET `getReports?propertyId={id}` → `{ data: Report[] }`
- `getReport(id)` → GET `getReportById?id={id}` → `{ data: Report }`
- `createReport(input)` → POST `createReport` → `{ data: Report }`

**File:** `src/services/userPreferencesService.ts`
- `getUserPreferences()` → GET `getUserPreferences` → `{ data: UserPreferences | null }`
- `updateUserPreferences(updates)` → PATCH `updateUserPreferences` → `{ data: UserPreferences }`

**File:** `src/services/directus.ts` (⚠️ **DEPRECATED** for user data)
- Only used for public CMS content:
  - `getDisclaimerBlocks()` → GET `/items/disclaimer_blocks?filter[is_active][_eq]=true&sort=order` → `{ data: DisclaimerBlock[] }`
  - `getJurisdictionContext(stateCode)` → GET `/items/jurisdiction_context?filter[state_code][_eq]={code}` → `{ data: JurisdictionContext[] }`

---

## 5) Storage / Upload Pipeline

### Image Flow

**1. File Selection/Capture**
- **Location:** `app/(tabs)/properties/[id]/photos/upload.tsx`
- **Methods:**
  - Library: `ImagePicker.launchImageLibraryAsync()` → `expo-image-picker`
  - Camera: `ImagePicker.launchCameraAsync()` → `expo-image-picker`
- **Permissions:** Requested via `requestMediaLibraryPermissionsAsync()` / `requestCameraPermissionsAsync()`

**2. Preprocessing/Compression**
- **Location:** `app/(tabs)/properties/[id]/photos/upload.tsx` → `uploadPhotos()` → `convertHeicToJpeg()`
- **HEIC Conversion (Web Only):**
  - Detects HEIC via URI/mimeType/fileName/file signature
  - Loads `heic2any` library (web-only, async require)
  - Converts HEIC → JPEG using `heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })`
  - Timeout: 20 seconds
  - Converts result Blob → base64 data URI
- **Native Platforms:**
  - Uses `preferredAssetRepresentationMode: Compatible` (iOS converts automatically)
  - No explicit compression (relies on Expo's quality: 0.8)
- **Base64 Conversion:**
  - Web: Uses `FileSystem.readAsStringAsync(uri, { encoding: Base64 })` or data URI directly
  - Native: Uses `FileSystem.readAsStringAsync(uri, { encoding: Base64 })`

**3. Upload Destination**
- **Location:** `src/services/photosService.ts` → `uploadFile()`
- **Flow:**
  1. Client sends base64 data URI to Firebase Function: `uploadFile`
  2. Firebase Function converts base64 → binary
  3. Firebase Function uploads to Directus `/files` endpoint (multipart/form-data)
  4. Directus stores file, returns file metadata
  5. Firebase Function returns file ID to client
- **Storage:** Directus file storage (configured in Directus instance)

**4. File Reference**
- **File ID:** Stored in `Photo.file` field (Directus file ID)
- **URL Generation:**
  - **Location:** `src/utils/fileUrl.ts`
  - **Method:** `getDirectusFileUrlWithAuth(fileId)` → Gets Firebase ID token → Calls Firebase Function `getFile?fileId={id}&token={token}`
  - **Firebase Function:** Proxies request to Directus `/assets/{fileId}?access_token={directusToken}`
  - **Returns:** Authenticated Directus asset URL
- **Usage:** `PRGPhotoGrid.tsx` → `PhotoImage` component → Loads URL async → Displays in `<Image>`

**5. Retry/Offline Behavior**
- **Retry:** `PRGPhotoGrid.tsx` → `PhotoImage` component → Retries URL generation up to 2 times (1s, 2s delays)
- **Offline:** No explicit offline handling (errors displayed, no queue)
- **Error Fallback:** Placeholder image: `https://via.placeholder.com/400?text=Error+Loading`

**6. Limits**
- **File Size:** Not explicitly limited in code (Directus/Expo may have limits)
- **File Types:** Images only (via `MediaTypeOptions.Images`)
- **HEIC Support:** Web only (requires WebAssembly, `heic2any` library)

### File Paths

- **Selection:** `app/(tabs)/properties/[id]/photos/upload.tsx` → `handlePickImages()`, `handleTakePhoto()`
- **Preprocessing:** `app/(tabs)/properties/[id]/photos/upload.tsx` → `uploadPhotos()` → `convertHeicToJpeg()`
- **Upload:** `src/services/photosService.ts` → `uploadFile()` → `backendClient.call('uploadFile')`
- **URL Generation:** `src/utils/fileUrl.ts` → `getDirectusFileUrlWithAuth()`
- **Display:** `src/components/PRGPhotoGrid.tsx` → `PhotoImage` component

---

## 6) Navigation & Screen Inventory

| Screen Name | Route Name/Path | Parent Route | Navigation Method | Expected Params | Missing Back Navigation |
|------------|----------------|--------------|-------------------|-----------------|------------------------|
| **Root** | `/` | - | Auto redirect | - | - |
| **Login** | `/(auth)/login` | `(auth)` | `router.replace('/(auth)/login')` | - | ✅ Has back (to signup) |
| **Sign Up** | `/(auth)/signup` | `(auth)` | `router.push('/(auth)/signup')` | - | ✅ Has back (to login) |
| **Properties List** | `/(tabs)/properties` | `(tabs)` | Tab bar, `router.replace('/(tabs)/properties')` | - | - |
| **Create Property** | `/(tabs)/properties/create` | `(tabs)/properties` | `router.push('/(tabs)/properties/create')` | - | ✅ Has back |
| **Property Dashboard** | `/(tabs)/properties/[id]` | `(tabs)/properties` | `router.push('/(tabs)/properties/${id}')` | `id: string` | ✅ Has back |
| **Upload Photos** | `/(tabs)/properties/[id]/photos/upload` | `(tabs)/properties/[id])` | `router.push('/(tabs)/properties/${id}/photos/upload')` | `id: string`, `spaceId?: string` | ✅ Has back |
| **Photo Detail** | `/(tabs)/properties/[id]/photos/[photoId]` | `(tabs)/properties/[id]` | `router.push('/(tabs)/properties/${id}/photos/${photoId}')` | `id: string`, `photoId: string` | ✅ Has back (inferred) |
| **Create Space** | `/(tabs)/properties/[id]/spaces/create` | `(tabs)/properties/[id]` | `router.push('/(tabs)/properties/${id}/spaces/create')` | `id: string` | ✅ Has back (inferred) |
| **Space Detail** | `/(tabs)/properties/[id]/spaces/[spaceId]` | `(tabs)/properties/[id]` | `router.push('/(tabs)/properties/${id}/spaces/${spaceId}')` | `id: string`, `spaceId: string` | ✅ Has back (inferred) |
| **Bulk Assignments** | `/(tabs)/properties/[id]/assignments/bulk` | `(tabs)/properties/[id]` | `router.push('/(tabs)/properties/${id}/assignments/bulk')` | `id: string` | ✅ Has back (inferred) |
| **Report Detail** | `/(tabs)/properties/[id]/reports/[reportId]` | `(tabs)/properties/[id]` | `router.push('/(tabs)/properties/${id}/reports/${reportId}')` | `id: string`, `reportId: string` | ✅ Has back (inferred) |
| **Inspections List** | `/(tabs)/inspections` | `(tabs)` | Tab bar | - | - |
| **New Inspection** | `/(tabs)/inspections/new` | `(tabs)/inspections` | `router.push('/(tabs)/inspections/new')` | `propertyId?: string` | ✅ Has back |
| **Inspection Wizard** | `/(tabs)/inspections/[id]` | `(tabs)/inspections` | `router.push('/(tabs)/inspections/${id}')` | `id: string` | ✅ Has back (inferred) |
| **Insights List** | `/(tabs)/insights` | `(tabs)` | Tab bar | - | - |
| **Insight Detail** | `/(tabs)/insights/[id]` | `(tabs)/insights` | `router.push('/(tabs)/insights/${id}')` | `id: string` | ✅ Has back (inferred) |
| **Profile** | `/(tabs)/profile` | `(tabs)` | Tab bar | - | - |

### Navigation Patterns

**Tab Navigation:**
- 4 main tabs: Properties, Inspections, Insights, Profile
- Configured in `app/(tabs)/_layout.tsx`
- Icons from `src/navigation/navIcon.ts`

**Stack Navigation:**
- Auth flow: Stack (login ↔ signup)
- Property detail: Stack (list → detail → sub-screens)
- Inspection flow: Stack (list → new → wizard)

**Internal Tabs:**
- Property dashboard: Tab bar within property detail (`PropertyOverview`, `PropertySpaces`, `PropertyPhotos`, `PropertyReport`)
- Implemented in `app/(tabs)/properties/[id].tsx` → `PRGTabBar` component

### Dead Ends / Missing Navigation

**⚠️ Potential Issues:**
- Photo detail screen may not have clear back navigation (inferred, not read)
- Space detail screen may not have clear back navigation (inferred, not read)
- Bulk assignments screen may not have clear back navigation (inferred, not read)
- Report detail screen may not have clear back navigation (inferred, not read)
- Inspection wizard may not have clear step navigation (inferred, not read)

---

## 7) State, Caching, and Side Effects

### Global State Libraries

**Zustand** (^4.5.0)
- **Location:** `src/state/`
- **Stores:**
  1. `authStore.ts` - Authentication state (active)
  2. `appStore.ts` - Mock data (⚠️ **UNUSED IN PRODUCTION**)

### Caching Strategy

**No Explicit Caching:**
- No React Query, SWR, or similar
- Data fetched on mount/refresh
- Pull-to-refresh implemented in list screens (`RefreshControl`)

**Implicit Caching:**
- Image caching: `<Image cache="force-cache" />` in `PRGPhotoGrid.tsx`
- Auth state: Persisted in secure storage (`storage.setToken()`, `storage.setUser()`)
- Theme preferences: Fetched on app load, cached in `useTheme()` hook (inferred)

### Side Effects

**Location:** React hooks (`useEffect`, `useCallback`) in screen components

**Common Patterns:**
- `useEffect(() => { loadData() }, [dependencies])` - Data loading on mount
- `useCallback()` - Memoized handlers
- `useState()` - Local component state

**Service Calls:**
- All API calls are async functions in services
- No global side effect management (Redux middleware, etc.)

### Prop Drilling Hotspots

**⚠️ Potential Issues:**
- Toast system: `useToast()` hook used in many screens (good pattern)
- Theme: `useTheme()` hook used in many components (good pattern)
- Auth state: `useAuthStore()` used in many screens (good pattern)
- Property data: Passed as props through property dashboard tabs (acceptable)

**No Major Prop Drilling:** Zustand hooks eliminate most prop drilling

### Duplicated Fetch Logic

**⚠️ Potential Issues:**
- Property loading: `propertiesService.getMyProperties()` called in multiple screens
- Photo loading: `photosService.getPhotos()` called in multiple screens
- Space loading: `spacesService.getSpaces()` called in multiple screens
- **No shared cache:** Each screen fetches independently

**Recommendation:** Consider React Query or similar for shared cache

---

## 8) Cross-Cutting Concerns Checklist

### Error Handling Patterns

**Toast System:**
- **Location:** `src/components/PRGToastProvider.tsx`, `src/components/PRGToast.tsx`
- **Usage:** `useToast()` hook → `showToast(message, type)`
- **Types:** 'success' | 'error' | 'info' (inferred)
- **Pattern:** Used in most screens for user-facing errors

**Try/Catch Locations:**
- **Service calls:** Wrapped in `try/catch` in screen components
- **Backend errors:** Thrown as `BackendError` → `src/services/backendClient.ts`
- **Error display:** Toast for user-facing errors, `console.error()` for debugging

**Missing Error Handling:**
- Some async operations may not have error handling (inferred)
- Network errors may not be retried (except photo URL loading)

### Loading States Patterns

**Components:**
- `PRGLoadingOverlay` - Full-screen overlay (`src/components/PRGLoadingOverlay.tsx`)
- `PRGButton` - Built-in loading prop (`loading={true}`)
- Local state: `const [loading, setLoading] = useState(true)`

**Patterns:**
- Initial load: `loading && data.length === 0` → Show loading UI
- Action load: `loading` prop on button → Disable button, show spinner
- Overlay: `PRGLoadingOverlay visible={uploading}` → Block UI during upload

### Logging Strategy

**Console Logging:**
- `console.log()` - Debug info (photo upload, URL generation)
- `console.error()` - Errors (caught in try/catch)
- `console.warn()` - Warnings (profile bootstrap failures)

**No Structured Logging:**
- No logging service (Sentry, LogRocket, etc.)
- No log levels (debug, info, warn, error)
- No remote logging

### Environment Variables Handling

**Location:** `process.env.EXPO_PUBLIC_*` (Expo public env vars)

**Variables Used:**
- `EXPO_PUBLIC_DIRECTUS_URL` - Directus instance URL (optional, enables real backend)
- `EXPO_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `EXPO_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID
- `EXPO_PUBLIC_USE_FIREBASE_EMULATOR` - Use Firebase emulator (optional)
- `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` - Emulator host (optional)
- `EXPO_PUBLIC_FIREBASE_EMULATOR_PORT` - Emulator port (optional)
- `EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL` - Firebase Functions URL (optional, inferred from project ID)

**Handling:**
- Read via `process.env.EXPO_PUBLIC_*`
- No validation (missing vars may cause runtime errors)
- No `.env` file in repo (should be in `.gitignore`)

### Feature Flags / Build Variants

**No Feature Flags:**
- No feature flag system
- No A/B testing
- No environment-based feature toggles

**Build Variants:**
- Mock mode: Enabled if `EXPO_PUBLIC_DIRECTUS_URL` not set
- Emulator mode: Enabled if `EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true'`

### Permissions & Access Control Checks

**Client-Side:**
- **Auth check:** `app/(tabs)/_layout.tsx` → `isAuthenticated` → Redirects to login
- **Property ownership:** Not checked client-side (enforced server-side)
- **Photo ownership:** Not checked client-side (enforced server-side)

**Server-Side:**
- All Firebase Functions verify user authentication (Firebase ID token)
- All user-owned data operations verify `app_profile_id` ownership
- Directus permissions configured server-side (via Firebase Functions)

**Missing:**
- No client-side role-based access control (RBAC)
- No permission checks in UI (e.g., hide delete button if not owner)

---

## 9) Tech Debt & Cleanup Opportunities (Non-Breaking)

### 1. Remove or Mark Mock Data Store as Dev-Only

**Why:** `src/state/appStore.ts` contains mock data that's unused in production (only used if Directus URL not set). This creates confusion about data flow.

**Files:**
- `src/state/appStore.ts`

**Risk:** Low (unused in production)

**Recommendation:** 
- Add `@deprecated` JSDoc
- Add comment: "Only used in mock mode (when EXPO_PUBLIC_DIRECTUS_URL not set)"
- Or remove entirely if mock mode not needed

### 2. Remove Deprecated Directus Client Methods

**Why:** `src/services/directus.ts` has deprecated methods for user-owned data (`getProperties()`, `createProperty()`, `getSpaces()`) that are marked with warnings but still exist. This creates confusion about which client to use.

**Files:**
- `src/services/directus.ts` (lines 307-393)

**Risk:** Low (methods have warnings, but could be accidentally used)

**Recommendation:**
- Remove deprecated methods entirely
- Keep only public CMS methods (`getDisclaimerBlocks()`, `getJurisdictionContext()`)
- Update any remaining usages to use domain services

### 3. Consolidate Backend Service Exports

**Why:** `src/services/backend.ts` is a legacy wrapper around `backendClient.ts`. Having both creates confusion about which to use.

**Files:**
- `src/services/backend.ts` (deprecated wrapper)
- `src/services/backendClient.ts` (canonical)

**Risk:** Low (wrapper is marked deprecated)

**Recommendation:**
- Remove `src/services/backend.ts`
- Update `src/services/index.ts` to export `backendClient` directly
- Update `src/state/authStore.ts` to use `backendClient` instead of `backend`

### 4. Standardize Entity Field Naming

**Why:** `Inspection` uses `property_id` and `inspection_id` instead of `property` and `inspection` (inconsistent with other entities).

**Files:**
- `src/types/index.ts` → `Inspection` interface
- `src/types/index.ts` → `InspectionStep` interface
- `src/services/inspectionsService.ts` (may need updates)

**Risk:** Medium (requires type changes, but types are not used in many places)

**Recommendation:**
- Rename `property_id` → `property` in `Inspection` type
- Rename `inspection_id` → `inspection` in `InspectionStep` type
- Update service methods to use new field names
- **Note:** This may require backend changes if Directus uses these field names

### 5. Extract Photo Upload Logic to Service

**Why:** `app/(tabs)/properties/[id]/photos/upload.tsx` contains 600+ lines of upload logic (HEIC conversion, base64 conversion, etc.). This should be extracted to a service.

**Files:**
- `app/(tabs)/properties/[id]/photos/upload.tsx` (lines 56-602)

**Risk:** Low (extraction doesn't change behavior)

**Recommendation:**
- Create `src/services/photoUploadService.ts`
- Move `convertHeicToJpeg()`, `dataUriToBlob()`, upload logic to service
- Keep UI logic (permissions, picker) in screen component

### 6. Consolidate Error Handling

**Why:** Error handling is scattered across screens. Some use `setError()`, others use `showToast()`. No centralized error handler.

**Files:**
- All screen components

**Risk:** Low (consolidation doesn't change behavior)

**Recommendation:**
- Create `src/utils/errorHandler.ts` with `handleError(error)` function
- Standardize on toast for user-facing errors
- Log all errors to console (or logging service)

### 7. Extract Date Formatting Logic

**Why:** Date formatting is duplicated across screens (`formatDate()` functions in multiple files).

**Files:**
- `app/(tabs)/properties/index.tsx` (lines 51-56)
- `app/(tabs)/inspections/index.tsx` (lines 43-46)
- Other screens (inferred)

**Risk:** Low (extraction doesn't change behavior)

**Recommendation:**
- Use `formatDisplayDate()` from `src/utils/directusDate.ts` everywhere
- Remove duplicate `formatDate()` functions

### 8. Consolidate Loading State Patterns

**Why:** Loading states are implemented differently across screens (some use `PRGLoadingOverlay`, others use local state with "Loading..." text).

**Files:**
- All screen components

**Risk:** Low (standardization doesn't change behavior)

**Recommendation:**
- Create `LoadingScreen` component for initial load
- Standardize on `PRGLoadingOverlay` for action loading
- Document loading patterns in component library

### 9. Remove Unused Theme Exports

**Why:** `src/theme/index.ts` exports both individual tokens and a `theme` object. The `theme` object may be unused (components use `useTheme()` hook).

**Files:**
- `src/theme/index.ts`

**Risk:** Low (removal doesn't break if unused)

**Recommendation:**
- Search for `theme` object usage
- Remove if unused
- Keep individual exports (`colors`, `typography`, `spacing`)

### 10. Extract File URL Generation to Service

**Why:** `src/utils/fileUrl.ts` has multiple functions (`getDirectusFileUrl()`, `getDirectusFileUrlSync()`, `getDirectusFileUrlWithAuth()`). The sync version is incomplete (doesn't add token).

**Files:**
- `src/utils/fileUrl.ts`

**Risk:** Low (refactoring doesn't change behavior)

**Recommendation:**
- Remove `getDirectusFileUrlSync()` (unused or incomplete)
- Keep only `getDirectusFileUrlWithAuth()` (used in `PRGPhotoGrid.tsx`)
- Move to `src/services/fileService.ts` if it grows

### 11. Consolidate Navigation Utilities

**Why:** Navigation logic is scattered (some use `router.push()`, others use `router.replace()`). No centralized navigation helpers.

**Files:**
- All screen components

**Risk:** Low (consolidation doesn't change behavior)

**Recommendation:**
- Create `src/navigation/routes.ts` with route constants
- Create `src/navigation/helpers.ts` with navigation helpers (`navigateToProperty(id)`, etc.)
- Use helpers instead of raw `router.push()`

### 12. Remove Duplicate Asset Directories

**Why:** `assets/nav_bar_symbols/` and `assets/nav_bar_symbols_final/` both exist. Only `nav_bar_symbols_final/` is used.

**Files:**
- `assets/nav_bar_symbols/` (unused)
- `assets/nav_bar_symbols_final/` (used in `src/navigation/navIcon.ts`)

**Risk:** Low (removal doesn't break if unused)

**Recommendation:**
- Verify `nav_bar_symbols/` is unused
- Remove if unused
- Rename `nav_bar_symbols_final/` → `nav_bar_symbols/`

### 13. Extract Form Validation Logic

**Why:** Form validation is duplicated across screens (email/password validation, required field checks).

**Files:**
- `app/(auth)/login.tsx`
- `app/(auth)/signup.tsx`
- `app/(tabs)/properties/create.tsx`
- Other form screens

**Risk:** Low (extraction doesn't change behavior)

**Recommendation:**
- Create `src/utils/validation.ts` with validation functions
- Use in all form screens

### 14. Consolidate Screen Container Patterns

**Why:** Some screens use `ScreenContainer`, others use `ScrollableScreenContainer`, others use raw `View`. No consistent pattern.

**Files:**
- All screen components

**Risk:** Low (standardization doesn't change behavior)

**Recommendation:**
- Standardize on `ScreenContainer` or `ScrollableScreenContainer`
- Document when to use each
- Update all screens to use consistent pattern

### 15. Remove Unused Type Exports

**Why:** `src/types/index.ts` may export types that are unused (e.g., `AppProfile` is only partially defined).

**Files:**
- `src/types/index.ts`

**Risk:** Low (removal doesn't break if unused)

**Recommendation:**
- Search for type usage across codebase
- Remove unused types
- Add JSDoc comments to all types

---

## 10) Open Questions / Unknowns

### 1. Inspection Wizard Implementation

**Question:** Is the inspection wizard (`app/(tabs)/inspections/[id].tsx`) fully implemented?

**Files to Check:**
- `app/(tabs)/inspections/[id].tsx` (not read)
- `src/screens/` (may contain inspection screen components)

**What to Verify:**
- Step navigation UI
- Step completion logic
- Progress calculation
- Final step handling

### 2. Photo Notes UI

**Question:** Is there a UI for editing photo notes?

**Files to Check:**
- `app/(tabs)/properties/[id]/photos/[photoId].tsx` (not read)

**What to Verify:**
- Notes input field
- Save functionality
- Display of existing notes

### 3. Bulk Assignment UI

**Question:** How does bulk photo assignment work?

**Files to Check:**
- `app/(tabs)/properties/[id]/assignments/bulk.tsx` (not read)

**What to Verify:**
- Multi-select UI
- Assignment flow
- Success/error handling

### 4. Report Generation Flow

**Question:** How are reports generated and viewed?

**Files to Check:**
- `src/screens/PropertyReport.tsx` (not fully read)
- `app/(tabs)/properties/[id]/reports/[reportId].tsx` (not read)

**What to Verify:**
- Report creation trigger
- PDF generation status
- PDF viewing/downloading

### 5. Insights Screen Implementation

**Question:** What does the insights screen show?

**Files to Check:**
- `app/(tabs)/insights/index.tsx` (not read)
- `app/(tabs)/insights/[id].tsx` (not read)

**What to Verify:**
- Data displayed
- Navigation to insights
- Relationship to inspections

### 6. Space Detail Screen

**Question:** What does the space detail screen show?

**Files to Check:**
- `app/(tabs)/properties/[id]/spaces/[spaceId].tsx` (not read)

**What to Verify:**
- Space information displayed
- Photo gallery for space
- Edit/delete functionality

### 7. Firebase Functions Implementation

**Question:** What Firebase Functions are implemented and how do they work?

**Files to Check:**
- `functions/src/index.ts` (not fully read)

**What to Verify:**
- All function endpoints
- Error handling
- Directus integration
- Ownership verification logic

### 8. Environment Variable Validation

**Question:** Are environment variables validated on app startup?

**Files to Check:**
- `src/services/firebase.ts` (has warnings, but no validation)
- `app/_layout.tsx` (may validate)

**What to Verify:**
- Missing env var handling
- Default values
- Error messages

### 9. Offline Support

**Question:** Is there any offline support or data persistence?

**Files to Check:**
- All service files (no offline logic seen)
- `src/services/storage.ts` (only auth data)

**What to Verify:**
- Offline queue
- Local data cache
- Sync on reconnect

### 10. Directus Collection Schema

**Question:** What is the exact Directus collection schema?

**Files to Check:**
- Directus admin panel (not in codebase)
- Firebase Functions (may have schema hints)

**What to Verify:**
- Field types
- Relationships
- Permissions
- Validation rules

---

## Summary

This codebase is a **well-structured React Native/Expo application** with a hybrid backend architecture (Firebase Auth + Firebase Functions + Directus). The code follows modern patterns (Zustand for state, Expo Router for navigation, TypeScript for types) but has some areas for cleanup (deprecated code, inconsistent naming, duplicated logic).

**Key Strengths:**
- Clear separation of concerns (services, components, screens)
- Consistent API client pattern (Firebase Functions)
- Good error handling (toast system)
- Type-safe (TypeScript throughout)

**Key Weaknesses:**
- Deprecated code still present (Directus client, backend wrapper)
- Inconsistent naming (Inspection uses `property_id` instead of `property`)
- No shared caching (React Query or similar)
- Large upload component (should be split)

**Safe Cleanup Opportunities:**
- Remove deprecated code
- Extract duplicated logic
- Standardize patterns
- Consolidate utilities

---

**End of Report**

