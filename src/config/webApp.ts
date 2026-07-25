/**
 * Public web app origin (Firebase Hosting).
 * Used for invite share-link fallbacks on the client.
 */
export function getWebAppBaseUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_WEB_APP_URL || "").trim().replace(
    /\/$/,
    ""
  );
  return fromEnv || "https://project-renter-guardian.web.app";
}

/**
 * @param {string} token Invite token.
 * @return {string} HTTPS invite URL.
 */
export function getInviteWebUrl(token: string): string {
  return `${getWebAppBaseUrl()}/invite/${encodeURIComponent(token)}`;
}

/**
 * @param {string} token Public share token.
 * @return {string} HTTPS public preview URL (no login).
 */
export function getPublicShareWebUrl(token: string): string {
  return `${getWebAppBaseUrl()}/share/${encodeURIComponent(token)}`;
}
