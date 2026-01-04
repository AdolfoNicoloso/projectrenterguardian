/**
 * Utility function to get Directus file URL from file ID
 * @param fileId The Directus file ID
 * @param accessToken Optional access token for authenticated file access
 * @returns The full URL to access the file
 */
export async function getDirectusFileUrl(
  fileId: string,
  accessToken?: string
): Promise<string> {
  const directusUrl = process.env.EXPO_PUBLIC_DIRECTUS_URL || '';
  
  if (!directusUrl) {
    // Fallback to placeholder if Directus URL not configured
    return `https://via.placeholder.com/400?text=Photo+${fileId.slice(-4)}`;
  }
  
  if (!fileId) {
    // Return placeholder if no file ID
    return `https://via.placeholder.com/400?text=No+Photo`;
  }
  
  // Remove trailing slash if present
  const baseUrl = directusUrl.replace(/\/+$/, '');
  
  // Directus file URL pattern: {DIRECTUS_URL}/assets/{file_id}
  let url = `${baseUrl}/assets/${fileId}`;
  
  // Add access token if provided (for authenticated file access)
  if (accessToken) {
    url += `?access_token=${encodeURIComponent(accessToken)}`;
  }
  
  return url;
}

/**
 * Async version that includes Firebase ID token in the URL
 * Use this when you need authentication for Image components
 */
export async function getDirectusFileUrlWithAuth(fileId: string): Promise<string> {
  if (!fileId) {
    console.warn('[getDirectusFileUrlWithAuth] No file ID provided');
    return `https://via.placeholder.com/400?text=No+Photo`;
  }
  
  // Import auth dynamically to avoid circular dependencies
  const { auth } = await import('../services/firebase');
  
  let idToken: string | null = null;
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[getDirectusFileUrlWithAuth] No current user');
      throw new Error('No authenticated user');
    }
    
    // Force refresh the token to ensure it's not expired
    idToken = await user.getIdToken(true);
    console.log('[getDirectusFileUrlWithAuth] Got fresh token, length:', idToken.length);
  } catch (error) {
    console.error('[getDirectusFileUrlWithAuth] Error getting token:', error);
    throw error;
  }

  if (!idToken) {
    console.warn('[getDirectusFileUrlWithAuth] No auth token available');
    throw new Error('Failed to get authentication token');
  }
  
  const functionsBaseUrl = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL || 
    'https://us-central1-project-renter-guardian.cloudfunctions.net';
  const baseUrl = functionsBaseUrl.replace(/\/+$/, '');
  
  // Encode the fileId and token properly
  const encodedFileId = encodeURIComponent(fileId);
  const encodedToken = encodeURIComponent(idToken);
  const url = `${baseUrl}/getFile?fileId=${encodedFileId}&token=${encodedToken}`;
  
  console.log('[getDirectusFileUrlWithAuth] Generated authenticated URL for fileId:', fileId);
  console.log('[getDirectusFileUrlWithAuth] URL length:', url.length);
  console.log('[getDirectusFileUrlWithAuth] Base URL:', baseUrl);
  console.log('[getDirectusFileUrlWithAuth] FileId length:', fileId.length);
  console.log('[getDirectusFileUrlWithAuth] Token length:', idToken.length);
  
  // Check if URL is too long (some browsers/servers have limits)
  if (url.length > 2000) {
    console.warn('[getDirectusFileUrlWithAuth] URL is very long:', url.length, 'characters');
    console.warn('[getDirectusFileUrlWithAuth] This may cause issues with some browsers/servers');
  }
  
  // Log first 100 chars of URL for debugging (without exposing full token)
  const urlPreview = url.substring(0, 100) + '...';
  console.log('[getDirectusFileUrlWithAuth] URL preview:', urlPreview);
  
  return url;
}

