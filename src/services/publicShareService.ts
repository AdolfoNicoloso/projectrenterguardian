import { backendClient } from './backendClient';
import { getFunctionsBaseUrl } from '../config/cloudFunctions';
import type { PropertyPublicShare } from '../types';

export type PublicPropertyPreview = {
  expires_at?: string | null;
  property: {
    id: string;
    display_name: string;
    address_free_text?: string;
    street?: string | null;
    unit?: string | null;
    city?: string | null;
    state_code?: string | null;
    zip?: string | null;
    listing_url?: string | null;
    status?: string | null;
  };
  spaces: Array<{
    id: string;
    display_name: string;
    space_type: string;
    custom_space_type?: string | null;
    ordinal?: number | null;
  }>;
  photos: Array<{
    id: string;
    file: string;
    space?: string | null;
    captured_at?: string | null;
    /** Short-lived signed GCS thumb URL when available. */
    thumb_url?: string | null;
    /** Short-lived signed GCS display URL when available. */
    display_url?: string | null;
  }>;
};

async function publicGetJson<T>(pathAndQuery: string): Promise<T> {
  const base = getFunctionsBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${base}/${pathAndQuery}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body && (body.error || body.message)) || `Request failed (${res.status})`
    );
  }
  return body as T;
}

export const publicShareService = {
  async create(propertyId: string): Promise<
    PropertyPublicShare & { share_message?: string; share_url?: string }
  > {
    const response = await backendClient.call<{
      data: PropertyPublicShare & { share_message?: string; share_url?: string };
    }>('createPropertyPublicShare', {
      method: 'POST',
      body: JSON.stringify({ propertyId }),
    });
    return response.data;
  },

  async revoke(shareId: string): Promise<void> {
    await backendClient.call('revokePropertyPublicShare', {
      method: 'POST',
      body: JSON.stringify({ shareId }),
    });
  },

  async getPreview(token: string): Promise<PublicPropertyPreview> {
    const response = await publicGetJson<{ data: PublicPropertyPreview }>(
      `getPublicPropertyPreview?token=${encodeURIComponent(token)}`
    );
    return response.data;
  },

  getPublicFileUrl(
    token: string,
    fileId: string,
    variant: 'thumb' | 'display' | 'original' = 'original'
  ): string {
    const base = getFunctionsBaseUrl().replace(/\/+$/, '');
    const variantParam =
      variant === 'original' ? '' : `&variant=${encodeURIComponent(variant)}`;
    return (
      `${base}/getPublicFile?token=${encodeURIComponent(token)}` +
      `&fileId=${encodeURIComponent(fileId)}${variantParam}`
    );
  },
};
