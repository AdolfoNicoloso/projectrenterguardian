import { getFunctionsBaseUrl } from '../config/cloudFunctions';

/** Media size variant requested from getFile / mint endpoints. */
export type MediaVariant = 'thumb' | 'display' | 'original';

/**
 * Placeholder image when no media id is available (sync; no auth).
 */
export function getMediaFilePlaceholderUrl(fileId: string | null | undefined): string {
  if (!fileId) {
    return 'https://via.placeholder.com/400?text=No+Photo';
  }
  return `https://via.placeholder.com/400?text=Photo+${String(fileId).slice(-4)}`;
}

/** @deprecated Use getMediaFilePlaceholderUrl */
export const getCmsFilePlaceholderUrl = getMediaFilePlaceholderUrl;

/** In-memory URL cache keyed by fileId + variant (getFile URL embeds a JWT). */
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_TTL_MS = 45 * 60 * 1000; // under Firebase ID token ~1h lifetime

function cacheKey(fileId: string, variant: MediaVariant): string {
  return `${fileId}:${variant}`;
}

/**
 * Clear cached media URLs (e.g. after sign-out).
 */
export function clearAuthenticatedMediaFileUrlCache(): void {
  urlCache.clear();
}

/** @deprecated Use clearAuthenticatedMediaFileUrlCache */
export const clearAuthenticatedCmsFileUrlCache =
  clearAuthenticatedMediaFileUrlCache;

/**
 * Media URL for the signed-in user via the `getFile` Cloud Function.
 * Uses cached Firebase ID token (no force-refresh) and caches getFile URLs
 * per file/variant. The Function typically responds with a 302 to a short-lived
 * signed GCS GET URL after ACL checks (bytes are not proxied when signing works).
 */
export async function getAuthenticatedMediaFileUrl(
  fileId: string,
  variant: MediaVariant = 'original'
): Promise<string> {
  if (!fileId) {
    return getMediaFilePlaceholderUrl(fileId);
  }

  const key = cacheKey(fileId, variant);
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  await imageUrlLoadGate.acquire();
  try {
    const again = urlCache.get(key);
    if (again && again.expiresAt > Date.now()) {
      return again.url;
    }

    const { auth } = await import('../services/firebase');

    let idToken: string;
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      idToken = await user.getIdToken();
    } catch (error) {
      console.error('[getAuthenticatedMediaFileUrl] Error getting token:', error);
      throw error;
    }

    const baseUrl = getFunctionsBaseUrl().replace(/\/+$/, '');
    const variantParam =
      variant === 'original' ? '' : `&variant=${encodeURIComponent(variant)}`;
    const url =
      `${baseUrl}/getFile?fileId=${encodeURIComponent(fileId)}` +
      `&token=${encodeURIComponent(idToken)}${variantParam}`;

    if (url.length > 2000) {
      console.warn(
        '[getAuthenticatedMediaFileUrl] URL is very long; some clients may reject it:',
        url.length
      );
    }

    urlCache.set(key, { url, expiresAt: Date.now() + URL_CACHE_TTL_MS });
    return url;
  } finally {
    imageUrlLoadGate.release();
  }
}

/** @deprecated Use getAuthenticatedMediaFileUrl */
export const getAuthenticatedCmsFileUrl = getAuthenticatedMediaFileUrl;

/**
 * Simple concurrency gate so grids do not stampede Auth + getFile.
 */
class ConcurrencyGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

/** Cap parallel authenticated media URL resolves / downloads. */
export const imageUrlLoadGate = new ConcurrencyGate(6);
