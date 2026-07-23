import { getFunctionsBaseUrl } from '../config/cloudFunctions';

/**
 * Placeholder image when no media id is available (sync; no auth).
 */
export function getCmsFilePlaceholderUrl(fileId: string | null | undefined): string {
  if (!fileId) {
    return 'https://via.placeholder.com/400?text=No+Photo';
  }
  return `https://via.placeholder.com/400?text=Photo+${String(fileId).slice(-4)}`;
}

/**
 * Media URL for the signed-in user via the `getFile` Cloud Function
 * (Storage bytes after Auth).
 */
export async function getAuthenticatedCmsFileUrl(
  fileId: string
): Promise<string> {
  if (!fileId) {
    return getCmsFilePlaceholderUrl(fileId);
  }

  const { auth } = await import('../services/firebase');

  let idToken: string;
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    idToken = await user.getIdToken(true);
  } catch (error) {
    console.error('[getAuthenticatedCmsFileUrl] Error getting token:', error);
    throw error;
  }

  const baseUrl = getFunctionsBaseUrl().replace(/\/+$/, '');
  const url = `${baseUrl}/getFile?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(idToken)}`;

  if (url.length > 2000) {
    console.warn(
      '[getAuthenticatedCmsFileUrl] URL is very long; some clients may reject it:',
      url.length
    );
  }

  return url;
}
