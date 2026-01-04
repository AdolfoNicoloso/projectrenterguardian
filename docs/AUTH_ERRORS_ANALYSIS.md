# Authentication Errors Analysis & Fixes

## Error Summary

### Error 1: Properties Screen
**Error**: `Error loading properties: BackendError: Authentication required`
**Location**: `app/(tabs)/properties/index.tsx:24`
**Call Stack**: `loadProperties` → `propertiesService.getMyProperties()` → `backendClient.call()` → `getIdToken()` fails

### Error 2: Theme Hook (during app init)
**Error**: `BackendError: Authentication required` 
**Location**: `src/theme/useTheme.ts:3` (during module initialization)
**Call Stack**: `useTheme` → `userPreferencesService.getUserPreferences()` → `backendClient.call()` → `getIdToken()` fails

## Root Cause

**Race Condition / Timing Issue**: Components are making authenticated API calls before Firebase Auth is fully initialized.

### Flow Analysis

1. **App Startup Sequence**:
   ```
   RootLayout mounts
   → checkAuth() starts (async)
   → TabsLayout renders (isLoading = true initially)
   → PropertiesListScreen mounts
   → useEffect runs immediately → loadProperties() called
   → API call made → auth.currentUser is null → ERROR
   ```

2. **The Problem**:
   - `RootLayout` calls `checkAuth()` in `useEffect` (async, non-blocking)
   - `TabsLayout` checks `isLoading`, but child screens render anyway
   - `PropertiesListScreen` mounts and immediately calls `loadProperties()` in `useEffect`
   - At this point, `checkAuth()` hasn't completed, so `auth.currentUser` is `null`
   - `getIdToken()` throws "User is not authenticated"

3. **Why `TabsLayout` protection isn't enough**:
   - `TabsLayout` shows `null` when `isLoading`, but child screens still mount
   - React renders screens in parallel with auth initialization
   - Screens use `useEffect` which runs after first render

## Potential Fixes

### ✅ Fix 1: Check Auth in Data-Loading Screens (Recommended)
**Approach**: Make each screen wait for authentication before making API calls.

**Implementation**:
- Check `isAuthenticated` and `isLoading` in screens before loading data
- Only call API when `isAuthenticated === true && isLoading === false`

**Pros**:
- Explicit and clear
- Each screen controls its own behavior
- Works well with React's rendering model

**Cons**:
- Need to update multiple screens
- Some code duplication

### ✅ Fix 2: Use useFocusEffect (Alternative)
**Approach**: Only load data when screen is focused AND auth is ready.

**Implementation**:
- Use `useFocusEffect` from `expo-router` instead of `useEffect`
- Check auth state inside the effect

**Pros**:
- Data refreshes when navigating to screen
- Natural fit for navigation-based apps

**Cons**:
- Still need to check auth state
- Might reload unnecessarily

### ✅ Fix 3: Add Auth Guard Component (Most Robust)
**Approach**: Create a wrapper component that prevents children from rendering until auth is ready.

**Implementation**:
- Create `<AuthGuard>` component
- Wraps screens and only renders children when `isAuthenticated && !isLoading`
- Shows loading state while waiting

**Pros**:
- Single point of control
- Prevents any rendering before auth
- Clean separation of concerns

**Cons**:
- Additional component layer
- Might delay initial render unnecessarily

### ⚠️ Fix 4: Synchronous Auth Check (Not Recommended)
**Approach**: Block rendering until auth is checked.

**Cons**:
- Can't easily do this with Firebase (async by nature)
- Would require complex state management
- Not idiomatic React

## Recommended Solution: Hybrid Approach

**Combine Fix 1 + Fix 3**:

1. **Add auth checks to critical screens** (Fix 1)
2. **Use AuthGuard for tab screens** (Fix 3)

This provides:
- ✅ Fast initial render (doesn't block unnecessarily)
- ✅ Explicit protection where needed
- ✅ Graceful loading states
- ✅ Clear error boundaries

## Implementation Priority

1. **Immediate**: Fix PropertiesListScreen (highest impact - blocking user)
2. **Quick**: Fix useTheme hook (already partially fixed, verify it works)
3. **Follow-up**: Add AuthGuard component for future-proofing
4. **Long-term**: Review all screens that load data on mount

## Code Changes Needed

### 1. PropertiesListScreen
```typescript
const { isAuthenticated, isLoading: authLoading } = useAuthStore();

useEffect(() => {
  if (!authLoading && isAuthenticated) {
    loadProperties();
  }
}, [authLoading, isAuthenticated]);
```

### 2. Verify useTheme Hook
Already updated, but verify the auth check is working correctly.

### 3. Other Screens to Fix
- Any screen with `useEffect(() => { loadData() }, [])` pattern
- Check: PropertyDetailScreen, InspectionsHomeScreen, ReportsListScreen, etc.

