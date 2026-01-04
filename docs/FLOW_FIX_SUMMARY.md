# Directus Flow Fix: Summary & Deliverables

## Investigation Results

### ✅ Task 1: Property Creation Method (COMPLETED)

**Finding**: Properties are created via `/items/properties` directly, NOT via flow trigger.

**Evidence:**
- `functions/src/index.ts:772` - Calls `directusRequest("/items/properties", { method: "POST" })`
- No references to `/flows/trigger/` in codebase
- Client → Firebase Function → Directus API (direct)

**Conclusion**: Flow must be configured as **Event Hook** (not Webhook).

---

## Root Cause Identified

### The Problem

1. **Wrong Flow Type**: Flow was likely configured as "Webhook" or "Manual" instead of "Event Hook"
2. **Wrong Variable Path**: Using `{{ $trigger.key }}` or `{{ $trigger.payload.id }}` which are `undefined` for Event Hooks
3. **Missing Property ID**: Flow couldn't access the created property UUID
4. **Result**: Spaces created with `property: null` → FK violation → 25P02 transaction abort

### The Fix

**Correct Configuration:**
- **Flow Type**: Event Hook
- **Trigger**: Items Create → `properties`
- **Property ID Variable**: `{{ $trigger.keys[0] }}`
- **Run As**: System

---

## Deliverables

### 1. ✅ Corrected Flow Configuration

**File**: `DIRECTUS_FLOW_CONFIGURATION.md`

**Key Points:**
- Flow Type: **Event Hook** (Items Create → `properties`)
- Property UUID: `{{ $trigger.keys[0] }}`
- Run As: **System**
- Space payload with correct field names and enum values

### 2. ✅ Added Instrumentation

**File**: `functions/src/index.ts` (lines 760-803)

**Added Logging:**
- Logs property creation request (endpoint, method, data)
- Logs Directus response (hasData, responseType)
- Logs created property ID for flow debugging
- All logs prefixed with `[createProperty]` for easy filtering

**Usage:**
```bash
# View Firebase Function logs
firebase functions:log --only createProperty

# Filter for property creation
grep "[createProperty]" firebase-debug.log
```

### 3. ✅ Space Schema Validation

**File**: `DIRECTUS_FLOW_CONFIGURATION.md` (Space Schema Requirements section)

**Confirmed:**
- Required fields: `property` (UUID), `display_name` (string), `space_type` (enum)
- Optional fields: `ordinal`, `is_default`
- Space type values: `"living_room"`, `"kitchen"`, `"bedroom"`, `"bathroom"`, `"other"` (exact)

### 4. ✅ Exact Variable Path

**For Event Hook → Items Create → `properties`:**

```
{{ $trigger.keys[0] }}
```

**Why:**
- Event Hooks provide `$trigger.keys` array
- `keys[0]` is the primary key (UUID) of the created item
- This is the ONLY reliable way to get the property ID in an Event Hook

**DO NOT USE:**
- `{{ $trigger.key }}` - Doesn't exist
- `{{ $trigger.payload.id }}` - Payload is request body, not response
- `{{ $trigger.id }}` - Doesn't exist

---

## Implementation Steps

### Step 1: Configure Flow in Directus

1. Go to Directus Admin → Flows
2. Create new flow (or edit existing)
3. **Trigger**:
   - Type: **Event Hook**
   - Scope: **Items**
   - Operation: **Create**
   - Collection: **properties**
4. **Step 1 (Debug - Remove Later)**:
   - Operation: **Run Script**
   - Code: See `DIRECTUS_FLOW_CONFIGURATION.md` for logging script
5. **Step 2 (Create Spaces)**:
   - Operation: **Create Data**
   - Collection: **spaces**
   - Mode: **Create Many**
   - Payload: See `DIRECTUS_FLOW_CONFIGURATION.md` for exact JSON
   - **Use `{{ $trigger.keys[0] }}` for property FK**
6. **Settings**:
   - Run As: **System**
   - Status: **Active**

### Step 2: Test from Admin UI

1. Create a property in Directus Admin UI
2. Verify 4 default spaces are created
3. Check Directus logs for errors
4. Remove debug step once confirmed working

### Step 3: Test from App

1. Create property via app
2. Check Firebase Function logs: `firebase functions:log --only createProperty`
3. Verify property appears in app
4. Verify spaces appear in app
5. Check Directus logs for flow execution

---

## Validation Checklist

- [ ] Flow type is "Event Hook" (not Webhook/Manual)
- [ ] Trigger collection is `properties`
- [ ] Property ID uses `{{ $trigger.keys[0] }}`
- [ ] Flow runs as "System"
- [ ] Flow status is "Active"
- [ ] Space types use exact values: `"living_room"`, `"kitchen"`, `"bedroom"`, `"bathroom"`
- [ ] Spaces have correct `property` FK (not null)
- [ ] No 25P02 errors in Directus logs
- [ ] Spaces appear in app after property creation

---

## Files Modified

1. **functions/src/index.ts**
   - Added logging to `createProperty` function
   - Logs property creation request and response
   - Logs created property ID for debugging

2. **DIRECTUS_FLOW_CONFIGURATION.md** (NEW)
   - Complete flow configuration guide
   - Variable path reference
   - Space schema requirements
   - Troubleshooting guide

3. **FLOW_FIX_SUMMARY.md** (THIS FILE)
   - Summary of investigation
   - Root cause analysis
   - Implementation steps

---

## Next Steps

1. **Deploy updated Firebase Function** (with logging):
   ```bash
   cd functions
   firebase deploy --only functions:createProperty
   ```

2. **Configure Flow in Directus** using `DIRECTUS_FLOW_CONFIGURATION.md`

3. **Test** from Admin UI first, then from app

4. **Monitor Logs**:
   - Firebase: `firebase functions:log --only createProperty`
   - Directus: Admin → Logs → Activity Log

5. **Remove Debug Step** from flow once confirmed working

---

## Expected Outcome

After implementing the correct flow configuration:

✅ Properties created successfully  
✅ 4 default spaces created automatically  
✅ Spaces have correct `property` FK  
✅ No 25P02 transaction errors  
✅ Spaces visible in app immediately after property creation  

---

## Support

If issues persist:
1. Check `DIRECTUS_FLOW_CONFIGURATION.md` troubleshooting section
2. Review Directus logs for FIRST error (before 25P02)
3. Verify flow execution in Directus Admin → Flows → [Your Flow] → Executions
4. Check Firebase Function logs for property creation details





