# How to Test getFile Function

## The 400 Error is Expected!

When you access the function URL without parameters, you get a 400 error because:
- The function requires `fileId` query parameter
- The function requires `token` query parameter (Firebase ID token)

This is **normal behavior** - the function is working correctly!

## Step-by-Step Test

### Step 1: Get Your Firebase ID Token

Open browser console (F12) and run:

```javascript
// Get token
const { auth } = await import('./src/services/firebase');
const user = auth.currentUser;
if (!user) {
  console.error('Not logged in');
} else {
  const token = await user.getIdToken(true);
  console.log('Token:', token);
  console.log('Copy this token for testing');
}
```

### Step 2: Get a File ID

The file ID is stored in the `file` field of each photo. You can get it automatically using the script below, or manually:

**Option A: Automatic (Recommended)**
- Use the test script below - it will find a file ID automatically

**Option B: Manual**
- Open browser console (F12)
- Run this to list all your photos with their file IDs:
```javascript
(async () => {
  const { photosService } = await import('./src/services/photosService');
  const { propertiesService } = await import('./src/services/propertiesService');
  const properties = await propertiesService.getProperties();
  for (const prop of properties) {
    const photos = await photosService.getPhotos(prop.id);
    console.log(`\n📸 Photos for "${prop.nickname || prop.id}":`);
    photos.forEach(photo => {
      console.log(`  Photo ID: ${photo.id}`);
      console.log(`  File ID: ${photo.file} ← Use this!`);
    });
  }
})();
```

### Step 3: Construct the Full URL

Format:
```
https://getfile-qjmlbdaraq-uc.a.run.app/getFile?fileId=YOUR_FILE_ID&token=YOUR_TOKEN
```

Or using the standard Firebase Functions URL:
```
https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=YOUR_FILE_ID&token=YOUR_TOKEN
```

### Step 4: Test in Browser

1. Paste the full URL in a new browser tab
2. Press Enter
3. **Expected**: You should see the image
4. **If 400**: Check that both `fileId` and `token` are in the URL
5. **If 401**: Token is invalid/expired - get a fresh one
6. **If 404**: File doesn't exist in Directus
7. **If 500**: Check Firebase Functions logs

## Simple Script: List All File IDs

If you just want to see all your file IDs, paste this in browser console:

```javascript
(async () => {
  try {
    const { photosService } = await import('./src/services/photosService');
    const { propertiesService } = await import('./src/services/propertiesService');
    const properties = await propertiesService.getProperties();
    
    if (properties.length === 0) {
      console.log('❌ No properties found');
      return;
    }
    
    console.log('📋 All File IDs:\n');
    let totalPhotos = 0;
    for (const prop of properties) {
      const photos = await photosService.getPhotos(prop.id);
      if (photos.length > 0) {
        totalPhotos += photos.length;
        console.log(`\n📸 Property: "${prop.nickname || prop.id}"`);
        photos.forEach((photo, idx) => {
          console.log(`  ${idx + 1}. Photo ID: ${photo.id}`);
          console.log(`     File ID: ${photo.file} ← Copy this!`);
        });
      }
    }
    
    if (totalPhotos === 0) {
      console.log('\n❌ No photos found. Upload a photo first!');
    } else {
      console.log(`\n✅ Found ${totalPhotos} photo(s) total`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

## Quick Test Script

Paste this in browser console - **it will automatically find a file ID and test the function!**

```javascript
async function testGetFile() {
  try {
    // 1. Get token
    const { auth } = await import('./src/services/firebase');
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Not logged in');
      return;
    }
    const token = await user.getIdToken(true);
    console.log('✅ Got token, length:', token.length);
    
    // 2. Automatically find a file ID from your photos
    console.log('🔍 Looking for photos...');
    const { photosService } = await import('./src/services/photosService');
    const { propertiesService } = await import('./src/services/propertiesService');
    
    // Get your properties
    const properties = await propertiesService.getProperties();
    if (properties.length === 0) {
      console.error('❌ No properties found. Create a property and upload a photo first.');
      return;
    }
    
    console.log(`✅ Found ${properties.length} property(ies)`);
    
    // Try to find a photo from any property
    let fileId = null;
    let photoFound = null;
    
    for (const property of properties) {
      try {
        const photos = await photosService.getPhotos(property.id);
        if (photos.length > 0) {
          photoFound = photos[0];
          fileId = photos[0].file;
          console.log(`✅ Found photo in property "${property.nickname || property.id}"`);
          console.log(`📸 Photo ID: ${photoFound.id}`);
          console.log(`📁 File ID: ${fileId}`);
          break;
        }
      } catch (err) {
        console.warn(`⚠️ Could not load photos for property ${property.id}:`, err);
      }
    }
    
    if (!fileId) {
      console.error('❌ No photos found. Please upload a photo first.');
      console.log('💡 Go to a property → Photos → Upload Photos');
      return;
    }
    
    // 3. Construct URL
    const baseUrl = 'https://us-central1-project-renter-guardian.cloudfunctions.net';
    const url = `${baseUrl}/getFile?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(token)}`;
    
    console.log('🔗 Testing URL (first 100 chars):', url.substring(0, 100) + '...');
    console.log('📏 Full URL length:', url.length);
    console.log('📋 File ID used:', fileId);
    
    // 4. Test the function
    console.log('⏳ Fetching...');
    const response = await fetch(url);
    
    console.log('📊 Status:', response.status);
    console.log('📄 Content-Type:', response.headers.get('content-type'));
    console.log('📦 Content-Length:', response.headers.get('content-length'));
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        console.log('✅ SUCCESS! Function returned image');
        const blob = await response.blob();
        console.log('🖼️ Image size:', blob.size, 'bytes');
        console.log('🖼️ Image type:', contentType);
        
        // Display the image
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.style.cssText = 'max-width: 500px; border: 3px solid green; margin: 20px;';
        document.body.appendChild(img);
        console.log('✅ Image displayed above - if you see it, the function works!');
      } else {
        console.error('❌ ERROR: Expected image, got:', contentType);
        const text = await response.text();
        console.error('Response:', text.substring(0, 500));
      }
    } else {
      console.error('❌ ERROR: Status', response.status);
      const text = await response.text();
      console.error('Error response:', text);
      
      if (response.status === 400) {
        console.error('💡 400 = Missing fileId or token in URL');
      } else if (response.status === 401) {
        console.error('💡 401 = Token invalid/expired - get a fresh token');
      } else if (response.status === 404) {
        console.error('💡 404 = File not found in Directus');
      } else if (response.status === 500) {
        console.error('💡 500 = Server error - check Firebase Functions logs');
      }
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

// Run it
testGetFile();
```

## What the 400 Error Means

The 400 error you saw is **correct behavior**:
- Function is deployed ✅
- Function is responding ✅
- Function is validating input ✅
- You just need to provide the required parameters

## Next Steps

1. Run the test script above in your browser console
2. Check what status code you get (should be 200 if everything works)
3. If you get 200, the function works - the issue is elsewhere
4. If you get an error, check the status code and error message

## Check Logs

After testing, check Firebase Functions logs:

```bash
firebase functions:log --only getFile --limit 20
```

You should see:
- `[getFile] Request for fileId: ...`
- `[getFile] Token verified for user: ...`
- `[getFile] Directus response status: ...`
- `[getFile] File size: ... bytes`
- `[getFile] Sending file response`

