# How to Check Firebase Functions Logs After Deployment

## Step 1: Deploy the Function

```bash
firebase deploy --only functions:getFile
```

Wait for deployment to complete. You should see:
```
✔  functions[getFile(us-central1)] Successful update operation.
```

## Step 2: Check Recent Logs

### Option A: Using Firebase CLI (Recommended)

```bash
# Get last 50 log entries for getFile function
firebase functions:log --only getFile --limit 50

# Get logs in real-time (follow mode)
firebase functions:log --only getFile --follow

# Get logs from last hour
firebase functions:log --only getFile --since 1h
```

### Option B: Using Firebase Console

1. Go to: https://console.firebase.google.com/project/project-renter-guardian/functions/logs
2. Filter by function name: `getFile`
3. Set time range to "Last hour" or "Last 24 hours"

## Step 3: What to Look For in Logs

### ✅ Success Flow (What you want to see):

```
[getFile] Request for fileId: 6b1d8842-75d6-4617-9b79-a88fa5fa8884
[getFile] Token verified for user: k7QGQNf0bkTn66lGayicikvwv5G3
[getFile] Fetching from Directus: https://volatis-v1.directus.app/assets/6b1d8842-75d6-4617-9b79-a88fa5fa8884
[getFile] Directus response status: 200
[getFile] File size: 123456 bytes, Content-Type: image/jpeg
[getFile] Sending file response
```

### ❌ Error Scenarios:

#### 1. Missing Token
```
[getFile] Request for fileId: ...
[getFile] Missing token
```
**Fix**: Token not being passed in URL

#### 2. Token Verification Failed
```
[getFile] Request for fileId: ...
[getFile] Token verification failed: Firebase ID token has expired
```
**Fix**: Token expired, need to refresh

#### 3. Directus Configuration Missing
```
[getFile] Directus configuration missing
```
**Fix**: Check Firebase secrets:
```bash
firebase functions:secrets:access DIRECTUS_URL
firebase functions:secrets:access DIRECTUS_SERVICE_TOKEN
```

#### 4. Directus File Not Found
```
[getFile] Fetching from Directus: https://...
[getFile] Directus response status: 404
[getFile] Directus error response: 404 - File not found
```
**Fix**: File doesn't exist in Directus or wrong file ID

#### 5. Directus Authentication Error
```
[getFile] Directus response status: 401
[getFile] Directus error response: 401 - Unauthorized
```
**Fix**: Directus service token invalid or expired

#### 6. Network/Fetch Error
```
[getFile] Fetch error: Failed to fetch
```
**Fix**: Network issue or Directus URL incorrect

#### 7. Buffer Read Error
```
[getFile] Buffer error: ...
```
**Fix**: Issue reading file data from Directus response

## Step 4: Filter Logs by Error Type

```bash
# See only errors
firebase functions:log --only getFile | grep -i "error\|failed\|missing"

# See token-related issues
firebase functions:log --only getFile | grep -i "token"

# See Directus-related issues
firebase functions:log --only getFile | grep -i "directus"

# See successful requests
firebase functions:log --only getFile | grep -i "sending file response"
```

## Step 5: Check Logs While Testing

1. Open terminal and run:
   ```bash
   firebase functions:log --only getFile --follow
   ```

2. In another terminal/browser, trigger an image load in your app

3. Watch the logs in real-time to see what happens

## Step 6: Common Log Patterns

### Pattern 1: Function Not Being Called
**Symptom**: No logs appear when loading images
**Possible causes**:
- Function not deployed
- Wrong URL being used
- Client-side error before request

### Pattern 2: Token Issues
**Symptom**: Logs show "Missing token" or "Token verification failed"
**Check**:
- Is token being generated? (Check browser console)
- Is token being passed in URL? (Check Network tab)
- Is token expired? (Tokens expire after 1 hour)

### Pattern 3: Directus Issues
**Symptom**: Logs show Directus errors (404, 401, 500)
**Check**:
- Does file exist in Directus?
- Is service token valid?
- Is Directus URL correct?

### Pattern 4: Function Works But Image Doesn't Load
**Symptom**: Logs show success but browser shows error
**Possible causes**:
- CORS issue (check Network tab)
- Image component issue
- URL encoding issue
- Browser cache issue

## Step 7: Detailed Log Analysis

For each request, check this sequence:

1. **Request received?**
   - Look for: `[getFile] Request for fileId: ...`
   - If missing: Function not being called

2. **Token verified?**
   - Look for: `[getFile] Token verified for user: ...`
   - If missing: Token issue

3. **Directus fetch successful?**
   - Look for: `[getFile] Directus response status: 200`
   - If not 200: Directus issue

4. **File data read?**
   - Look for: `[getFile] File size: ... bytes`
   - If missing: Buffer read issue

5. **Response sent?**
   - Look for: `[getFile] Sending file response`
   - If missing: Response sending issue

## Quick Debug Commands

```bash
# See all getFile logs from last hour
firebase functions:log --only getFile --since 1h

# Count successful vs failed requests
firebase functions:log --only getFile --since 1h | grep -c "Sending file response"
firebase functions:log --only getFile --since 1h | grep -c "error\|failed"

# See unique file IDs being requested
firebase functions:log --only getFile --since 1h | grep "Request for fileId" | sort | uniq

# See all errors
firebase functions:log --only getFile --since 1h | grep -i "error\|failed" | tail -20
```

## Example: Full Debug Session

```bash
# 1. Deploy
firebase deploy --only functions:getFile

# 2. Start watching logs
firebase functions:log --only getFile --follow

# 3. In browser, try to load an image

# 4. In logs, you should see:
# [getFile] Request for fileId: ...
# [getFile] Token verified for user: ...
# [getFile] Fetching from Directus: ...
# [getFile] Directus response status: 200
# [getFile] File size: ... bytes
# [getFile] Sending file response

# 5. If you see errors, note which step failed
```

