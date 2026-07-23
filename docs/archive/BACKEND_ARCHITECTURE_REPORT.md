# Backend Architecture Report
## Renter Guardian - Current Implementation

**Date:** Current  
**Status:** Hybrid Architecture (Firebase Auth + Directus Data)

---

## Overview

The application uses a **hybrid backend architecture** combining two services:
- **Firebase Authentication** - User authentication and identity management
- **Directus CMS** - Data storage and API for application content

---

## Authentication Layer (Firebase)

### How It Works
- Users register/login through Firebase Authentication
- Supports **Email/Password** and **Google Sign-In**
- Firebase manages user accounts, passwords, and OAuth flows
- User data stored locally after authentication:
  - User ID (Firebase UID)
  - Email
  - Display name
  - Photo URL

### Authentication Flow
1. User signs up/logs in → Firebase creates/authenticates user
2. Firebase returns access token → Stored in secure storage
3. User data cached locally for app state
4. Token used for... **currently nothing** (see Issues below)

**Location:** `src/services/firebase.ts`, `src/state/authStore.ts`

---

## Data Layer (Directus)

### How It Works
- Directus CMS provides REST API for all application data
- Collections include: Properties, Spaces, Photos, Reports, etc.
- All data operations go through Directus API endpoints
- Uses token-based authentication (Bearer tokens)

### API Access Pattern
```
Base URL: EXPO_PUBLIC_DIRECTUS_URL
Method: Standard REST (GET, POST, PATCH)
Format: { data: T } or { data: T[] }
Authentication: Bearer token in Authorization header
```

### Collections Used
- `/items/properties` - Property listings
- `/items/spaces` - Room/space definitions
- `/items/photos` - Property photos
- `/items/photo_space_assignments` - Photo-to-space mappings
- `/items/reports` - Move-in reports
- `/items/disclaimer_blocks` - Legal disclaimers
- `/items/jurisdiction_context` - State-specific content
- `/files` - File uploads

### Query Patterns
- Filtering: `filter[field][_eq]=value`
- Sorting: `sort=field`
- Example: `/items/spaces?filter[property][_eq]=123`

**Location:** `src/services/directus.ts`

---

## Current Architecture Flow

```
User Registration/Login
    ↓
Firebase Authentication
    ↓
Firebase Token Stored Locally
    ↓
User Authenticated in App
    ↓
Directus API Calls
    ↓
❌ Token Mismatch (Firebase token ≠ Directus token)
```

---

## Key Issues & Gaps

### 1. **Authentication Disconnect**
- **Problem:** Firebase tokens are stored, but Directus expects Directus access tokens
- **Impact:** Directus requests may fail or work without proper user context
- **Current State:** Directus requests may work if collection permissions allow public access

### 2. **No User Profile Sync**
- **Problem:** When users register in Firebase, no corresponding profile is created in Directus
- **Impact:** 
  - Properties can't be properly associated with users
  - All properties currently use hardcoded `app_profile_id: 'profile-1'`
  - No user data isolation

### 3. **Missing User Isolation**
- **Problem:** Property queries don't filter by user
- **Current:** `getProperties()` returns ALL properties (no user filtering)
- **Should be:** `getProperties()` filtered by user's `app_profile_id`

### 4. **No Profile Management**
- **Problem:** No methods to create/read/update `app_profiles` collection
- **Impact:** Can't link Firebase users to Directus user profiles

---

## Data Model Relationship

```
Firebase User (Authentication)
    ↓ (Missing Link)
Directus app_profiles (User Profile)
    ↓ (One-to-Many)
Directus properties
    ↓ (One-to-Many)
Directus spaces, photos, reports
```

**Current State:** The link between Firebase users and Directus `app_profiles` is missing.

---

## What Works

✅ User authentication (Firebase)  
✅ User registration (Firebase)  
✅ Google Sign-In (Firebase)  
✅ Data retrieval from Directus  
✅ Data creation in Directus  
✅ File uploads to Directus  

## What Doesn't Work

❌ User-specific data isolation  
❌ Automatic profile creation on signup  
❌ Linking Firebase users to Directus profiles  
❌ Filtering properties by authenticated user  

---

## Recommended Next Steps

1. **Create Profile Sync Service**
   - Auto-create `app_profile` in Directus when Firebase user registers
   - Store mapping: Firebase UID → Directus `app_profile_id`

2. **Update Directus Client**
   - Add `app_profiles` collection methods
   - Add user profile lookup/creation functions

3. **Implement User Filtering**
   - Update `getProperties()` to filter by user's `app_profile_id`
   - Ensure all user-specific queries include profile filtering

4. **Token Strategy**
   - Determine if Directus needs separate authentication
   - Or configure Directus to accept Firebase tokens (if supported)

---

## Technical Details

### Authentication Storage
- **Location:** `src/services/storage.ts`
- **Method:** Expo SecureStore (native) / localStorage (web)
- **Stores:** Firebase access tokens, user data

### Directus Client
- **Location:** `src/services/directus.ts`
- **Pattern:** Class-based service with async methods
- **Mock Mode:** Falls back to in-memory data if `EXPO_PUBLIC_DIRECTUS_URL` not set

### State Management
- **Location:** `src/state/authStore.ts`
- **Library:** Zustand
- **Manages:** Authentication state, user data, login/logout

---

## Configuration

### Environment Variables Required
```env
# Firebase (Required)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Directus (Optional - enables real backend)
EXPO_PUBLIC_DIRECTUS_URL=https://your-directus-instance.com
```

---

## Summary

The backend uses a **hybrid approach** that works for basic functionality but needs integration work to properly link authentication (Firebase) with data ownership (Directus). The main gap is the missing bridge between Firebase user accounts and Directus user profiles, which prevents proper user data isolation and ownership.

**Status:** Functional for development, needs integration work for production user isolation.

