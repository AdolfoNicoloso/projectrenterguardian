# How to Test Image URL Directly

## Step 1: Get a Fresh Firebase ID Token

Open your browser's Developer Console (F12 or Cmd+Option+I) and run:

```javascript
// Get the Firebase auth instance
const { auth } = await import('./src/services/firebase');

// Get current user
const user = auth.currentUser;

if (user) {
  // Force refresh to get a new token
  const token = await user.getIdToken(true);
  console.log('Token:', token);
  console.log('Token length:', token.length);
  
  // Copy this token - you'll need it for testing
  copy(token); // This copies to clipboard (if supported)
} else {
  console.error('No user logged in');
}
```

**Alternative method** (if the above doesn't work):
```javascript
// In browser console, after the app is loaded
window.__getToken = async () => {
  const { auth } = await import('./src/services/firebase');
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(true);
    console.log('Token:', token);
    return token;
  }
  return null;
};

// Then call it:
const token = await window.__getToken();
console.log(token);
```

## Step 2: Get a File ID

You need a file ID from one of your photos. You can get it from:
- Browser console: Look for `[getDirectusFileUrlWithAuth] Generated authenticated URL for fileId: ...`
- Or check your photos data - the `file` field contains the file ID
- Example file ID from your error: `6b1d8842-75d6-4617-9b79-a88fa5fa8884`

## Step 3: Construct the Test URL

Format:
```
https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=YOUR_FILE_ID&token=YOUR_TOKEN
```

Example:
```
https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=6b1d8842-75d6-4617-9b79-a88fa5fa8884&token=eyJhbGciOiJSUzI1NiIs...
```

## Step 4: Test the URL

### Option A: Paste in Browser Address Bar
1. Copy the full URL
2. Paste it in a new browser tab
3. Press Enter
4. **Expected**: You should see the image
5. **If error**: You'll see what the error is

### Option B: Use curl (Terminal)
```bash
# Replace YOUR_FILE_ID and YOUR_TOKEN with actual values
curl -v "https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=YOUR_FILE_ID&token=YOUR_TOKEN" -o test-image.png

# Check if file was downloaded
file test-image.png
# Should show: test-image.png: PNG image data, ... OR JPEG image data, ...
```

### Option C: Use Browser DevTools Network Tab
1. Open DevTools → Network tab
2. Paste URL in address bar
3. Check the request:
   - **Status**: Should be 200
   - **Content-Type**: Should be `image/jpeg` or `image/png`
   - **Response**: Should show image preview (not JSON)

## What to Look For

### ✅ Success Indicators:
- Status code: 200
- Content-Type: `image/jpeg`, `image/png`, or `image/*`
- Response shows image (not JSON text)
- File downloads successfully

### ❌ Error Indicators:
- Status code: 401 → Token invalid/expired
- Status code: 404 → File not found OR function not deployed
- Status code: 500 → Server error (check logs)
- Content-Type: `application/json` → Function returned error (should be PNG now)
- CORS error → CORS not configured correctly
- "Failed to load resource" → Network/function issue

## Quick Test Script

Save this as `test-image-url.js` and run in browser console:

```javascript
async function testImageUrl() {
  try {
    // Get token
    const { auth } = await import('./src/services/firebase');
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }
    
    const token = await user.getIdToken(true);
    console.log('✓ Got token, length:', token.length);
    
    // Use a file ID from your photos (replace with actual file ID)
    const fileId = '6b1d8842-75d6-4617-9b79-a88fa5fa8884'; // Replace with actual file ID
    
    // Construct URL
    const url = `https://us-central1-project-renter-guardian.cloudfunctions.net/getFile?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(token)}`;
    console.log('✓ URL constructed, length:', url.length);
    console.log('URL:', url.substring(0, 100) + '...');
    
    // Test the URL
    console.log('Testing URL...');
    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Response Content-Type:', response.headers.get('content-type'));
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        console.log('✅ SUCCESS: Function returned image!');
        console.log('Content-Type:', contentType);
        const blob = await response.blob();
        console.log('Image size:', blob.size, 'bytes');
        
        // Create a test image element
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.style.width = '200px';
        img.style.border = '2px solid green';
        document.body.appendChild(img);
        console.log('✅ Image displayed above');
      } else {
        console.error('❌ ERROR: Expected image, got:', contentType);
        const text = await response.text();
        console.error('Response body:', text.substring(0, 200));
      }
    } else {
      console.error('❌ ERROR: Response not OK');
      const text = await response.text();
      console.error('Error response:', text);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

// Run it
testImageUrl();
```

