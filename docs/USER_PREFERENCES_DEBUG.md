# User Preferences 500 Error - Debugging Guide

## Current Error
```
Error loading user preferences: [BackendError: Directus request failed: 500 - [{"message":"An unexpected error occurred.","extensions":{"code":"INTERNAL_SERVER_ERROR"}}]]
```

## Most Likely Causes

### 1. Field Type Mismatch (MOST LIKELY)
**Problem**: `user_preferences.app_profile_id` field type doesn't match `app_profiles.id` type.

**Check in Directus**:
1. Go to **Settings → Data Model → `app_profiles`**
   - Check the `id` field type (UUID or Integer/Auto-increment?)
   
2. Go to **Settings → Data Model → `user_preferences`**
   - Check the `app_profile_id` field type
   - It should match the `app_profiles.id` type:
     - If `app_profiles.id` is **UUID** → `user_preferences.app_profile_id` should be **UUID**
     - If `app_profiles.id` is **Integer** → `user_preferences.app_profile_id` should be **Integer** or **Big Integer**

**Fix**: Make sure both fields use the same type!

### 2. Field Doesn't Exist
**Check**: In Directus, verify that `user_preferences` collection has an `app_profile_id` field.

### 3. Collection Doesn't Exist
**Check**: Verify `user_preferences` collection exists in Directus.

### 4. Check Firebase Function Logs
After deploying with the new logging, check Firebase Console → Functions → Logs to see:
- The actual `appProfileId` value being queried
- The exact error from Directus

## Quick Diagnostic Steps

1. **Check `app_profiles.id` type**:
   - Directus Admin → Settings → Data Model → `app_profiles`
   - Note the `id` field type

2. **Check `user_preferences.app_profile_id` type**:
   - Directus Admin → Settings → Data Model → `user_preferences`
   - Check if `app_profile_id` field exists
   - Check its type matches `app_profiles.id`

3. **Check Function Logs** (after deploying):
   ```bash
   firebase functions:log --only getUserPreferences
   ```
   Look for the `[getUserPreferences]` log entries to see what `appProfileId` value is being used.

## Expected Field Configuration

### If `app_profiles.id` is UUID:
```
user_preferences:
  - app_profile_id: UUID (required)
  - theme_preference: String (required)
```

### If `app_profiles.id` is Integer:
```
user_preferences:
  - app_profile_id: Integer or Big Integer (required)
  - theme_preference: String (required)
```

## After Fixing Field Type

1. Deploy the updated functions (with logging):
   ```bash
   firebase deploy --only functions:getUserPreferences,functions:updateUserPreferences
   ```

2. Test again - the error should be resolved.

3. Check logs if still failing to see the exact Directus error message.

