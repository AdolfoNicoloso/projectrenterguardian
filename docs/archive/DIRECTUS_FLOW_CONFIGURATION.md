# Default Spaces Creation: Implementation

## Solution: Backend Function Creates Spaces Directly

### Why Not Use Directus Flow?

**Problem**: Directus Event Hook `trigger.keys[0]` is `undefined` in some configurations, making it unreliable to access the created property ID.

**Solution**: Create default spaces directly in the Firebase Function after property creation. This is more reliable because:
1. We have the property ID immediately after creation
2. No dependency on flow trigger context
3. Easier to debug and maintain
4. Atomic operation (spaces created right after property)

---

## Implementation (COMPLETED)

### Property Creation Method (CONFIRMED)

**The app creates properties via `/items/properties` directly:**

1. Client calls: `propertiesService.createProperty()` 
2. Which calls: Firebase Function `createProperty`
3. Which calls: Directus `/items/properties` POST endpoint
4. **Backend function then creates default spaces immediately**

**Evidence:**
- `functions/src/index.ts` line 782: `directusRequest("/items/properties", { method: "POST", ... })`
- `functions/src/index.ts` line 816-870: Creates default spaces after property creation
- No flow dependency needed

---

## Root Cause Analysis (RESOLVED)

### The Original Problem

The Directus Flow approach had issues:
- **Event Hook trigger context**: `{{ $trigger.keys[0] }}` was `undefined`
- **Missing property ID**: Flow couldn't access the created property UUID
- **Spaces created with null FK**: Foreign key constraint violation → transaction abort (25P02)

---

## Current Implementation: Backend Function Creates Spaces

### Code Location

**File**: `functions/src/index.ts`  
**Function**: `createProperty`  
**Lines**: 816-870

### How It Works

1. Property is created via Directus API
2. Backend function receives the created property with ID
3. Backend function immediately creates 4 default spaces
4. Spaces are created with correct `property` FK
5. If space creation fails, property creation still succeeds (spaces can be created manually)

### Default Spaces Created

```typescript
[
  {
    property: propertyId,
    display_name: "Bedroom 1",
    space_type: "bedroom",
    ordinal: 10,
    is_default: true,
  },
  {
    property: propertyId,
    display_name: "Bathroom 1",
    space_type: "bathroom",
    ordinal: 20,
    is_default: true,
  },
  {
    property: propertyId,
    display_name: "Kitchen",
    space_type: "kitchen",
    ordinal: 30,
    is_default: true,
  },
  {
    property: propertyId,
    display_name: "Living Room",
    space_type: "living_room",
    ordinal: 40,
    is_default: true,
  },
]
```

### Error Handling

- If space creation fails, the error is logged but property creation still succeeds
- Spaces can be created manually later if needed
- All errors are logged with `[createProperty]` prefix for easy debugging

---

## Space Schema Requirements

Based on TypeScript types (`src/types/index.ts`):

### Required Fields:
- `property` (string, UUID) - Foreign key to `properties.id`
- `display_name` (string) - Display name for the space
- `space_type` (enum) - One of: `'living_room' | 'kitchen' | 'hallway' | 'bedroom' | 'bathroom' | 'other'`

### Optional Fields:
- `ordinal` (number) - Sort order
- `is_default` (boolean) - Whether this is a default space
- `date_created` (auto)
- `date_updated` (auto)

### Space Type Values (EXACT):
- `"living_room"` (with underscore)
- `"kitchen"`
- `"hallway"`
- `"bedroom"`
- `"bathroom"`
- `"other"`

**Note**: Must match exactly - `"living-room"` or `"livingroom"` will fail validation.

---

## Testing Checklist

### 1. Test Property Creation from App
- [ ] Create property via app (Firebase Function → Directus)
- [ ] Verify 4 default spaces are created automatically
- [ ] Verify property appears in app
- [ ] Verify spaces appear in app
- [ ] Check Firebase Function logs: `firebase functions:log --only createProperty`
- [ ] Look for `[createProperty] Default spaces created: 4` in logs

### 2. Verify Space Creation
- [ ] Check Directus Admin UI → Spaces collection
- [ ] Verify 4 spaces exist for the property
- [ ] Verify spaces have correct `property` FK (not null)
- [ ] Verify spaces have correct `space_type` values
- [ ] Verify `ordinal` values are 10, 20, 30, 40
- [ ] Verify `is_default` is true for all

### 3. Error Scenarios
- [ ] If space creation fails, property should still be created
- [ ] Check logs for any space creation errors
- [ ] Verify no 25P02 transaction errors
- [ ] Verify no FK constraint violations

---

## Troubleshooting

### If spaces are not created:

1. **Check Firebase Function Logs**:
   ```bash
   firebase functions:log --only createProperty | grep "createProperty"
   ```
   Look for:
   - `[createProperty] Property created successfully` - confirms property ID
   - `[createProperty] Creating default spaces` - confirms space creation started
   - `[createProperty] Default spaces created: 4` - confirms success
   - Any error messages

2. **Check Directus Logs**:
   - Go to Directus Admin → Logs → Activity Log
   - Look for space creation entries
   - Check for any FK constraint violations

3. **Verify Service Token Permissions**:
   - Service token must have CREATE permission on `spaces` collection
   - Check in Directus Admin → Settings → Roles & Permissions

### Common Errors:

**Error: `property` is null**
- **Cause**: Property ID not extracted correctly
- **Fix**: Check logs for `propertyId` value in `[createProperty] Property created successfully`

**Error: `space_type` invalid**
- **Cause**: Wrong enum value (e.g., `"living-room"` instead of `"living_room"`)
- **Fix**: Code uses exact values: `"living_room"`, `"kitchen"`, `"bedroom"`, `"bathroom"`

**Error: Permission denied**
- **Cause**: Service token doesn't have CREATE permission on `spaces`
- **Fix**: Grant CREATE permission to service token role

**Error: 25P02 (transaction aborted)**
- **Cause**: This is a symptom - check the FIRST error in logs
- **Fix**: Usually FK constraint or NOT NULL violation - check Directus logs for root cause

---

## Implementation Status

✅ **COMPLETED** - Default spaces are created directly in the backend function.

### No Directus Flow Required

The backend function (`createProperty`) now:
1. Creates the property
2. Immediately creates 4 default spaces
3. Handles errors gracefully (property creation succeeds even if spaces fail)

### Deployment

Deploy the updated function:
```bash
cd functions
firebase deploy --only functions:createProperty
```

---

## Summary

- **Property Creation**: Via `/items/properties` POST (direct API call)
- **Space Creation**: Directly in backend function after property creation
- **No Flow Required**: Spaces created via API call, not flow trigger
- **Space Types**: `"living_room"`, `"kitchen"`, `"bedroom"`, `"bathroom"` (exact values)
- **Required Fields**: `property` (UUID), `display_name` (string), `space_type` (enum)
- **Error Handling**: Property creation succeeds even if space creation fails

