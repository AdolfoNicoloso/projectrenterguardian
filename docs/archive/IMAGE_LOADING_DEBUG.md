# Image Loading Debug Guide

## Problem
Images are not loading - getting "Failed to load resource" errors when trying to display photos.

## All Possible Failure Points

### 1. **Function Not Deployed**
**Symptom**: 404 errors or function doesn't exist
**Check**: 
```bash
firebase functions:list | grep getFile
```
**Fix**: Deploy the function
```bash
firebase deploy --only functions:getFile
```

### 2. **Token Issues**
**Possible causes**:
- Token expired (JWT tokens expire after 1 hour)
- Token not being generated
- Token not being passed correctly in URL
- Token encoding issues

**Check**:
- Browser console: Look for `[getDirectusFileUrlWithAuth] Got fresh token`
- Check token length in console logs
- Verify `auth.currentUser` exists

**Debug**:
```javascript
// In browser console
const user = auth.currentUser;
if (user) {
  const token = await user.getIdToken(true);
  console.log('Token length:', token.length);
  console.log('Token preview:', token.substring(0, 50) + '...');
}
```

### 3. **URL Length Limits**
**Issue**: Very long URLs (JWT tokens are ~1000+ chars) can exceed browser/server limits
**Check**: 
- Browser console: `[getDirectusFileUrlWithAuth] URL length: ...`
- Most browsers limit URLs to ~2000 characters
- Some servers limit to 2048 characters

**Fix**: If URL > 2000 chars, consider using POST with token in body (but Image component can't do this)

### 4. **CORS Issues**
**Symptom**: CORS errors in browser console
**Check**: 
- Network tab: Look for CORS errors
- Check if preflight (OPTIONS) is handled
- Verify CORS headers are set

**Current implementation**: Function has `cors: true` and `setCorsHeaders()` - should work

### 5. **Function Returning JSON Instead of Binary**
**Symptom**: Image component fails because it receives JSON error instead of image
**Check**: 
- Network tab: Check response Content-Type
- Should be `image/png` or `image/jpeg`, NOT `application/json`
- Check response body - should be binary, not JSON

**Fix**: All error paths now return transparent PNG via `sendImageError()`

### 6. **Directus File Not Found**
**Symptom**: Function returns 404 from Directus
**Check**:
- Firebase Functions logs: `[getFile] Directus error response: 404`
- Verify fileId exists in Directus
- Check Directus file permissions

**Debug**:
```bash
# Check Firebase Functions logs
firebase functions:log --only getFile
```

### 7. **Directus Service Token Issues**
**Symptom**: 401/403 from Directus
**Check**:
- Firebase Functions logs: `[getFile] Directus error response: 401`
- Verify `DIRECTUS_SERVICE_TOKEN` secret is set correctly
- Check if service token has expired

**Fix**:
```bash
# Check secrets
firebase functions:secrets:access DIRECTUS_SERVICE_TOKEN
```

### 8. **React Native Image Component Limitations**
**Issue**: Image component may not handle:
- Very long URLs
- Query parameters with special characters
- Certain content types
- Cached responses incorrectly

**Check**:
- Try opening the URL directly in browser
- Check if URL works when pasted into browser address bar
- Verify Image component `onError` callback

### 9. **Network/Firewall Issues**
**Possible causes**:
- Firewall blocking Firebase Functions
- Network timeout
- DNS resolution issues

**Check**:
- Try accessing function URL from different network
- Check if other Firebase Functions work
- Verify DNS resolution

### 10. **Function Execution Timeout**
**Issue**: Function takes too long and times out
**Check**:
- Firebase Functions logs for timeout errors
- Default timeout is 60 seconds for v2 functions
- Large files may take time to fetch from Directus

### 11. **Buffer/Encoding Issues**
**Issue**: File buffer not being converted correctly
**Check**:
- Firebase Functions logs: `[getFile] File size: ... bytes`
- Verify `arrayBuffer()` works correctly
- Check if Buffer.from() handles the data correctly

### 12. **Content-Type Issues**
**Issue**: Wrong Content-Type header causes Image component to fail
**Check**:
- Network tab: Check response headers
- Should match file type (image/jpeg, image/png, etc.)
- Verify Directus returns correct Content-Type

### 13. **Image Component Cache Issues**
**Issue**: Cached error responses prevent retry
**Check**:
- Clear app cache
- Try with `cache: 'reload'` instead of `'force-cache'`
- Check if Image component respects cache headers

### 14. **Environment Variable Issues**
**Issue**: Wrong Firebase Functions URL
**Check**:
- Verify `EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL` is set correctly
- Check if using emulator vs production
- Verify URL format matches Firebase Functions v2

### 15. **Firebase Functions v2 Response Handling**
**Issue**: v2 functions may handle responses differently than v1
**Check**:
- Verify `res.send(Buffer)` works in v2
- Check if need to use `res.end()` instead
- Verify binary response handling

## Step-by-Step Debugging Process

### Step 1: Verify Function is Deployed
```bash
firebase functions:list
# Should see getFile in the list
```

### Step 2: Check Function Logs
```bash
firebase functions:log --only getFile --limit 50
```
Look for:
- `[getFile] Request for fileId: ...`
- `[getFile] Token verified for user: ...`
- `[getFile] Fetching from Directus: ...`
- `[getFile] Directus response status: ...`
- `[getFile] File size: ... bytes`
- `[getFile] Sending file response`

### Step 3: Test Function Directly
1. Get a fresh token:
```javascript
// In browser console
const user = auth.currentUser;
const token = await user.getIdToken(true);
console.log(token);
```

2. Test URL in browser:
```
https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=YOUR_FILE_ID&token=YOUR_TOKEN
```

3. Check response:
- Should see image, not JSON
- Check Network tab for status code
- Check response headers (Content-Type should be image/*)

### Step 4: Check Client-Side Logs
In browser console, look for:
- `[getDirectusFileUrlWithAuth] Got fresh token, length: ...`
- `[getDirectusFileUrlWithAuth] Generated authenticated URL for fileId: ...`
- `[getDirectusFileUrlWithAuth] URL length: ...`
- `[PhotoImage] Setting image URI for photo: ...`
- `[PhotoImage] Image loaded successfully: ...` OR error messages

### Step 5: Network Tab Analysis
1. Open DevTools → Network tab
2. Filter by "getFile"
3. Click on the request
4. Check:
   - **Request URL**: Is it correct? Does it have fileId and token?
   - **Request Method**: Should be GET
   - **Status Code**: What is it? (200 = success, 401 = auth error, 404 = not found, 500 = server error)
   - **Response Headers**: 
     - `Content-Type`: Should be `image/jpeg` or `image/png`, NOT `application/json`
     - `Content-Length`: Should be > 0
   - **Response**: Should be binary data (shows as image preview), NOT JSON

### Step 6: Verify Directus File Exists
1. Check if fileId exists in Directus
2. Verify file is accessible with service token
3. Test Directus URL directly:
```
https://your-directus-url.com/assets/FILE_ID
```
(With Authorization: Bearer SERVICE_TOKEN header)

## Most Likely Issues (Based on Error Message)

Given the error "Failed to load resource", the most likely causes are:

1. **Function returning JSON error** (now fixed - all errors return PNG)
2. **Function not deployed** - Check with `firebase functions:list`
3. **Token expired/invalid** - Check logs for token verification failures
4. **Directus file not found** - Check logs for 404 from Directus
5. **CORS blocking** - Check Network tab for CORS errors
6. **URL too long** - Check URL length in console logs

## Quick Fixes to Try

1. **Force token refresh**:
```javascript
// Already implemented with getIdToken(true)
```

2. **Clear cache and retry**:
```javascript
// Image component already has retry logic
```

3. **Check if function is actually deployed**:
```bash
firebase deploy --only functions:getFile
```

4. **Verify secrets are set**:
```bash
firebase functions:secrets:access DIRECTUS_URL
firebase functions:secrets:access DIRECTUS_SERVICE_TOKEN
```

5. **Test with a simple image URL**:
Try using a public image URL to verify Image component works:
```javascript
<Image source={{ uri: 'https://via.placeholder.com/400' }} />
```

## Next Steps

1. Check Firebase Functions logs to see which error path is being hit
2. Test the function URL directly in browser with a fresh token
3. Check Network tab to see actual HTTP response
4. Verify Directus file exists and is accessible
5. Check if URL length is causing issues

