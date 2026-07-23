# Fixing 500 Error for user_preferences Collection

## The Problem

Getting `500 Internal Server Error` when querying `user_preferences` collection, even though permissions are set correctly.

## Most Likely Cause

The field name used in the filter doesn't match the actual field name in Directus. There are two possibilities:

### Option A: Field is named `app_profile_id` (UUID/String field)
- Use: `filter[app_profile_id][_eq]=...`
- ✅ Current code uses this

### Option B: Field is a relationship field named `app_profile` (like `properties.app_profile`)
- Use: `filter[app_profile][_eq]=...`
- ⚠️ Need to change code to use this

## How to Check in Directus

1. Go to **Settings** → **Data Model** → `user_preferences` collection
2. Check the `app_profile_id` field:
   - **If it shows as "Many to One (M2O)" or "One to One (O2O)" relationship:**
     - The relationship field name is likely `app_profile` (without `_id`)
     - Change the filter to use `filter[app_profile][_eq]=...`
   - **If it shows as "UUID" or "String" type (not a relationship):**
     - Keep using `filter[app_profile_id][_eq]=...`
     - The 500 error might be due to something else

## Quick Fix: Try Relationship Field Name

If `app_profile_id` is set up as a relationship in Directus, change the filter queries:

**In `getUserPreferences` function (around line 3802):**
```typescript
// Change from:
"/items/user_preferences?filter[app_profile_id][_eq]=" + encodedProfileId

// To:
"/items/user_preferences?filter[app_profile][_eq]=" + encodedProfileId
```

**In `updateUserPreferences` function (around line 3898):**
```typescript
// Change from:
"/items/user_preferences?filter[app_profile_id][_eq]=" + encodedProfileId

// To:
"/items/user_preferences?filter[app_profile][_eq]=" + encodedProfileId
```

**When creating (around line 3929), keep as is:**
```typescript
const createData = {
  app_profile_id: appProfileId,  // This is correct for creation
  theme_preference: input.theme_preference || "auto",
};
```

## Other Possible Causes

1. **Field doesn't exist**: Check that `app_profile_id` field exists in the collection
2. **Field type mismatch**: Ensure the field type matches what we're sending (UUID vs String)
3. **Collection doesn't exist**: Verify the collection name is exactly `user_preferences`
4. **Permissions issue**: Even with CRUD permissions, there might be field-level permissions blocking the filter

## Verification Steps

1. Check Directus logs for more detailed error message
2. Try a simple query in Directus API playground:
   ```
   GET /items/user_preferences?filter[app_profile_id][_eq]=<some-uuid>
   ```
3. Check if the field name in the collection schema matches what we're using

## Recommended Fix

**If `app_profile_id` is a relationship field**, update the code to use the relationship field name `app_profile` (without `_id`) in filter queries, similar to how `properties` collection uses `filter[app_profile][_eq]=...`

