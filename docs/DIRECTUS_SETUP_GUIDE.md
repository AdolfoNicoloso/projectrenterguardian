# Directus Setup Guide for Firebase Functions Integration

## Problem: Directus 500 Error / UUID Type Mismatch

### Error Message:
```
invalid input syntax for type uuid: "vfGswcPtlUanOysxIrvcYHIPT4D3"
```

### Root Cause:
The `firebase_uid` field in Directus `app_profiles` collection is set to **UUID type**, but Firebase UIDs are **strings** (not UUIDs). Directus is trying to cast the Firebase UID string as a UUID and failing.

### Solution:
Change the `firebase_uid` field type from **UUID** to **String** in Directus.

---

## Required Directus Configuration

---

## Required Directus Configuration

### 1. Create `app_profiles` Collection

The collection must exist with these exact fields:

#### Collection Name: `app_profiles`

#### Fields:
- **`id`** (Auto-increment or UUID)
  - Type: Integer (auto-increment) or UUID
  - Primary key
  
- **`firebase_uid`** (Required) ⚠️ **CRITICAL: Must be String type, NOT UUID**
  - Type: **String** (VARCHAR/TEXT) - **NOT UUID**
  - Required: Yes
  - Unique: Yes (recommended)
  - Length: 128+ characters (Firebase UIDs can be 28-128 chars)
  - Used to link Firebase users to Directus profiles
  - **Common mistake:** Setting this to UUID type will cause the error above
  
- **`email`** (Optional)
  - Type: String
  - Required: No
  - Used to store user email from Firebase
  
- **`display_name`** (Optional)
  - Type: String
  - Required: No
  - Used to store user's display name from Firebase
  
- **`date_created`** (Auto-managed)
  - Type: Timestamp
  - Auto-generate on create
  
- **`date_updated`** (Auto-managed)
  - Type: Timestamp
  - Auto-update on modify

### 2. Configure Collection Permissions

The **Directus Service Token** must have permissions to:

#### Read Access:
- ✅ Read `app_profiles` collection
- ✅ Filter by `firebase_uid`

#### Write Access:
- ✅ Create new `app_profiles` records
- ✅ Update `app_profiles` records

#### In Directus Admin:
1. Go to **Settings** → **Roles & Permissions**
2. Find the role/user associated with your service token
3. For `app_profiles` collection:
   - **Read**: ✅ Allow
   - **Create**: ✅ Allow
   - **Update**: ✅ Allow (if needed)
   - **Delete**: ❌ Not needed (optional)

### 3. Verify Service Token Permissions

Your `DIRECTUS_SERVICE_TOKEN` must:
- ✅ Have access to `app_profiles` collection
- ✅ Be able to query with filters
- ✅ Be able to create new records

**Test the service token:**
```bash
curl -X GET "https://your-directus-url.com/items/app_profiles" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN"
```

If this returns 403 or 500, the token doesn't have permissions.

---

## Alternative: Check if Collection Uses Different Field Names

If `app_profiles` already exists but uses different field names, you may need to:

### Option A: Update Directus Collection
Rename/update fields to match:
- `firebase_uid` (or map from existing field)
- `email`
- `display_name`

### Option B: Update Firebase Function Code
If the collection has different field names, update `getOrCreateAppProfile()` in `functions/src/index.ts` to match your schema.

**Common variations:**
- `firebase_user_id` instead of `firebase_uid`
- `user_email` instead of `email`
- `name` instead of `display_name`

---

## Debugging Steps

### 1. Check if Collection Exists

In Directus Admin:
- Go to **Content** → Check if `app_profiles` appears in collections

### 2. Check Collection Schema

In Directus Admin:
- Go to **Settings** → **Data Model** → `app_profiles`
- Verify field names match exactly

### 3. Test Service Token Directly

```bash
# Test read access
curl -X GET "https://your-directus-url.com/items/app_profiles" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json"

# Test create access
curl -X POST "https://your-directus-url.com/items/app_profiles" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firebase_uid": "test-uid-123",
    "email": "test@example.com",
    "display_name": "Test User"
  }'
```

### 4. Check Firebase Function Logs

In Firebase Console:
- Go to **Functions** → **Logs**
- Look for detailed error messages from Directus

---

## Quick Fix: Create Collection via Directus Admin

### Step-by-Step:

1. **Open Directus Admin Panel**
   - Navigate to your Directus instance

2. **Create New Collection**
   - Go to **Settings** → **Data Model**
   - Click **Create Collection**
   - Name: `app_profiles`
   - Primary Key: `id` (Integer, Auto-increment)

3. **Add Fields**
   - Click **Add Field** for each:
     - `firebase_uid` (String, Required, Unique)
     - `email` (String, Optional)
     - `display_name` (String, Optional)

4. **Set Permissions**
   - Go to **Settings** → **Roles & Permissions**
   - Find role associated with service token
   - Enable Read + Create for `app_profiles`

5. **Save and Test**

---

## Verify It Works

After setup, test:

1. **Deploy Functions:**
   ```bash
   firebase deploy --only functions:bootstrapProfile,functions:getMyProperties
   ```

2. **Log in to App:**
   - The `bootstrapProfile` function should create an `app_profile`
   - Check Directus Admin → `app_profiles` collection
   - You should see a new record with your Firebase UID

3. **Load Properties:**
   - `getMyProperties` should work without 500 errors

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **UUID type error:** `invalid input syntax for type uuid` | **Change `firebase_uid` field type from UUID to String in Directus** ⚠️ |
| Collection doesn't exist | Create `app_profiles` collection (see above) |
| Field names don't match | Update collection fields OR update function code |
| Service token has no permissions | Grant Read + Create permissions in Directus |
| UID contains special characters | ✅ Fixed: Now URL-encoded in function |
| Collection exists but empty | Normal - profiles created on first login |

---

## ⚠️ CRITICAL FIX: Change firebase_uid Field Type

If you're getting this error:
```
invalid input syntax for type uuid: "vfGswcPtlUanOysxIrvcYHIPT4D3"
```

### Step-by-Step Fix:

1. **Open Directus Admin Panel**
   - Navigate to your Directus instance

2. **Go to Data Model**
   - Settings → **Data Model** → `app_profiles`

3. **Edit `firebase_uid` Field**
   - Click on the `firebase_uid` field
   - Check its current **Type**

4. **Change Type to String**
   - If it's set to **UUID**, change it to **String** (or **VARCHAR**)
   - Set **Length**: 128 (or larger, Firebase UIDs can be up to 128 chars)
   - Ensure **Required** is checked
   - Ensure **Unique** is checked (recommended)

5. **Save Changes**
   - Click **Save**
   - Directus will update the database schema

6. **Test Again**
   - Try logging in again
   - The error should be resolved

### Why This Happens:
- Firebase UIDs are **alphanumeric strings** (e.g., `vfGswcPtlUanOysxIrvcYHIPT4D3`)
- They are **NOT** standard UUIDs (which look like `550e8400-e29b-41d4-a716-446655440000`)
- Directus UUID type enforces strict UUID format validation
- When Directus tries to compare a Firebase UID string against a UUID column, it fails

### Verification:
After changing to String type, the SQL query should work:
```sql
SELECT * FROM app_profiles WHERE firebase_uid = 'vfGswcPtlUanOysxIrvcYHIPT4D3'
```

---

## Next Steps After Setup

Once `app_profiles` is working:

1. ✅ User logs in → `app_profile` created automatically
2. ✅ Properties filtered by `app_profile_id`
3. ✅ User data isolation enforced

The error should disappear once the collection exists with correct permissions!

