# HEIC2ANY Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Library Not Loading
**Symptoms:** `heic2any is not a function` or `Failed to load heic2any`

**Possible Causes:**
- Expo bundler doesn't support the library's WebAssembly
- Version incompatibility
- Import method not working

**Solutions:**
1. Check browser console for the exact error
2. Try updating to latest version: `npm install heic2any@latest`
3. The code now uses dynamic `import()` instead of `require()` which should help

### Issue 2: Conversion Timeout
**Symptoms:** Conversion hangs or times out after 30 seconds

**Possible Causes:**
- Large file size
- WebAssembly not supported in browser
- Browser compatibility issues

**Solutions:**
1. Check browser console for WebAssembly errors
2. Try a smaller HEIC file
3. Check if browser supports WebAssembly: `typeof WebAssembly !== 'undefined'`

### Issue 3: "HEIC conversion returned no result"
**Symptoms:** Conversion completes but returns empty/null

**Possible Causes:**
- heic2any returned empty array
- Blob type mismatch
- File format not recognized

**Solutions:**
1. Check blob type before conversion
2. Ensure blob has correct MIME type (`image/heic` or `image/heif`)
3. Try converting a known-good HEIC file

### Issue 4: Server Still Rejects as HEIC
**Symptoms:** Client converts but server still detects HEIC

**Possible Causes:**
- Data URI prefix still contains `image/heic`
- MIME type not updated correctly
- Filename still has `.heic` extension

**Solutions:**
1. Check console logs for `[PhotoUpload] Converted HEIC - final values:`
2. Verify data URI prefix is `data:image/jpeg;base64,`
3. Verify filename ends with `.jpg`

## Debugging Steps

1. **Check if heic2any loads:**
   - Look for: `[PhotoUpload] heic2any loaded successfully` in console
   - If missing, check: `[PhotoUpload] Failed to load heic2any:`

2. **Check if conversion starts:**
   - Look for: `[PhotoUpload] Converting HEIC to JPEG on web...`
   - Look for: `[PhotoUpload] Calling heic2any with blob:`

3. **Check conversion result:**
   - Look for: `[PhotoUpload] Conversion successful:`
   - Check the `base64Prefix` in logs

4. **Check what's sent to server:**
   - Look for: `[PhotoUpload] Uploading file to server:`
   - Verify `isHeicType: false` and `isHeicName: false`

## Alternative Solutions

If heic2any continues to fail, consider:

1. **Remove heic2any entirely** - Rely only on iOS native conversion
2. **Use a different library** - Research alternatives
3. **Server-side conversion** - Convert on server (but we removed this due to sharp limitations)
4. **User instruction** - Ask users to convert HEIC to JPEG manually before uploading

## Current Implementation

- Uses dynamic `import()` for better bundler compatibility
- Loads library asynchronously when needed
- Has 30-second timeout protection
- Ensures data URI prefix is `data:image/jpeg;base64,`
- Updates filename to `.jpg`

## Next Steps

1. Check browser console for specific error messages
2. Verify WebAssembly support: `console.log('WebAssembly:', typeof WebAssembly)`
3. Try updating heic2any: `npm install heic2any@latest`
4. Test with a known-good HEIC file

