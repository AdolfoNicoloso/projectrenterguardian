# HEIC to JPEG Conversion Setup

## What Was Implemented

The `uploadFile` Firebase Function now automatically converts HEIC/HEIF files to JPEG format before uploading to Directus. This ensures compatibility with React Native's Image component and web browsers.

## Changes Made

1. **Added `sharp` dependency** to `functions/package.json`
2. **Added HEIC detection** in the upload function
3. **Implemented automatic conversion** from HEIC/HEIF to JPEG
4. **Updated filename and MIME type** after conversion

## Installation Required

Before deploying, you need to install the `sharp` package:

```bash
cd functions
npm install
```

This will install `sharp` and its dependencies.

## How It Works

1. **Detection**: The function checks if the uploaded file is HEIC/HEIF by:
   - MIME type (`image/heic`, `image/heif`)
   - File extension (`.heic`, `.heif`)

2. **Conversion**: If HEIC is detected:
   - Uses `sharp` to convert to JPEG with 90% quality
   - Updates the filename (`.heic` → `.jpg`)
   - Updates the MIME type (`image/heic` → `image/jpeg`)

3. **Upload**: The converted JPEG is uploaded to Directus instead of the original HEIC file

## Benefits

- ✅ HEIC files are automatically converted to a compatible format
- ✅ No client-side changes needed
- ✅ Users can upload HEIC files from iOS devices without issues
- ✅ All images display correctly in the app

## Testing

After deployment, test by:
1. Uploading a HEIC file from an iOS device
2. Checking that the image displays correctly in the app
3. Verifying the file in Directus is a JPEG (not HEIC)

## Logs

The function logs conversion details:
```
[uploadFile] HEIC/HEIF file detected, converting to JPEG...
[uploadFile] Converted HEIC to JPEG. Original: 1234567 bytes, Converted: 987654 bytes
```

## Error Handling

If conversion fails, the function returns a 500 error with details. The original file is not uploaded in this case.

