/**
 * Shared helpers for HTTPS Cloud Function handlers.
 */
/* eslint-disable require-jsdoc, valid-jsdoc */

import * as admin from "firebase-admin";
import * as domain from "../firestore";

export const REGION = "us-central1";
/** Default options for most HTTPS handlers. */
export const FN_OPTS = {region: REGION, cors: true as const};
/**
 * Heavier options for base64 media uploads (capped ~15MB).
 * Prefer createMediaUpload + client PUT to a GCS resumable session URL.
 */
export const UPLOAD_FN_OPTS = {
  region: REGION,
  cors: true as const,
  memory: "1GiB" as const,
  timeoutSeconds: 120,
  concurrency: 20,
};
/**
 * Media read proxy (getFile). Needs headroom when signed URLs fail and
 * grids stampede concurrent thumb downloads through the function.
 */
export const MEDIA_READ_FN_OPTS = {
  region: REGION,
  cors: true as const,
  memory: "1GiB" as const,
  timeoutSeconds: 60,
  concurrency: 40,
};

export type Res = {
  set: (name: string, value: string) => void;
  setHeader: (name: string, value: string) => void;
  redirect: (statusOrUrl: number | string, url?: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    send: (body: string | Buffer) => void;
  };
};

export type Req = {
  method?: string;
  get: (name: string) => string | undefined;
  body: unknown;
  query: Record<string, string | undefined>;
};

export function extractBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

export function getBearerToken(req: Req): string | null {
  const authHeader =
    req.get("Authorization") || req.get("authorization") || "";
  return extractBearerToken(authHeader);
}

export async function verifyFirebaseUser(
  req: Req
): Promise<admin.auth.DecodedIdToken> {
  const idToken = getBearerToken(req);
  if (!idToken) {
    throw new Error(
      "Missing Authorization header. Expected: Bearer <Firebase ID token>"
    );
  }
  return admin.auth().verifyIdToken(idToken);
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function setCorsHeaders(res: Res, req: Req): void {
  const origin = req.get("origin") || req.get("Origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.set("Access-Control-Max-Age", "3600");
}

export function handleCorsPreflight(req: Req, res: Res): boolean {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res, req);
    res.status(204).send("");
    return true;
  }
  return false;
}

export function getTransparentPng(): Buffer {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGA" +
    "WjR9awAAAABJRU5ErkJggg==";
  return Buffer.from(pngBase64, "base64");
}

export function sendImageError(res: Res, req: Req, statusCode: number): void {
  setCorsHeaders(res, req);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache");
  res.status(statusCode).send(getTransparentPng());
}

export function displayNameFromToken(
  decoded: admin.auth.DecodedIdToken
): string | null {
  const t = decoded as {name?: string; displayName?: string};
  return t.name || t.displayName || null;
}

export async function resolveProfile(
  decoded: admin.auth.DecodedIdToken
): Promise<string> {
  const phone =
    (decoded as {phone_number?: string}).phone_number ?? null;
  const appProfileId = await domain.getOrCreateAppProfile({
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: displayNameFromToken(decoded),
    phone,
  });
  // Best-effort: pending invites → in-app notifications (no auto-accept).
  try {
    await domain.notifyPendingInvitesForProfile(appProfileId, {
      email: decoded.email ?? null,
      phone,
    });
  } catch (err: unknown) {
    console.warn(
      "[resolveProfile] notify pending invites failed",
      getErrorMessage(err)
    );
  }
  return appProfileId;
}

export function parseBody<T extends Record<string, unknown>>(body: unknown): T {
  if (typeof body === "string") {
    return JSON.parse(body) as T;
  }
  return (body || {}) as T;
}

export function statusForError(err: unknown): number {
  const msg = getErrorMessage(err);
  if (
    msg === "NOT_FOUND" ||
    msg === "PHOTO_NOT_FOUND" ||
    msg.includes("NOT_FOUND")
  ) {
    return 404;
  }
  if (
    msg === "VALIDATION" ||
    msg === "BAD_SPACE" ||
    msg === "BAD_SPACE_TYPE" ||
    msg === "BAD_INSPECTION_TYPE" ||
    msg === "PROPERTY_NOT_ACTIVE" ||
    msg === "PROPERTY_NOT_ELIGIBLE" ||
    msg === "BAD_PROPERTY_STATUS" ||
    msg === "LEASE_REQUIRED_FOR_ACTIVE" ||
    msg === "ACCOUNT_DELETE_INCOMPLETE" ||
    msg === "BAD_INVITE_ROLE" ||
    msg === "INVITE_CONTACT_REQUIRED" ||
    msg === "CANNOT_INVITE_OWNER" ||
    msg === "ALREADY_MEMBER" ||
    msg === "INVITE_ALREADY_PENDING" ||
    msg === "INVITE_NOT_PENDING" ||
    msg === "INVITE_EXPIRED" ||
    msg === "INVITE_IDENTITY_MISMATCH" ||
    msg === "CANNOT_DELETE_COMPLETED" ||
    msg.includes("VALIDATION")
  ) {
    return 400;
  }
  if (msg === "FORBIDDEN") {
    return 403;
  }
  return 500;
}

export function sendErr(res: Res, req: Req, err: unknown): void {
  setCorsHeaders(res, req);
  const code = getErrorMessage(err);
  const friendly: Record<string, string> = {
    PROPERTY_NOT_ACTIVE: "Only active properties can start an inspection.",
    PROPERTY_NOT_ELIGIBLE:
      "This property cannot start that inspection. " +
      "Active properties can start any type; " +
      "Touring properties can only start a Tour.",
    BAD_PROPERTY_STATUS: "Invalid property status.",
    LEASE_REQUIRED_FOR_ACTIVE:
      "Set a lease start date before marking a property Active.",
    ACCOUNT_DELETE_INCOMPLETE:
      "Account deletion did not finish cleaning Firestore. Please try again.",
    BAD_INSPECTION_TYPE: "Invalid inspection type.",
    NOT_FOUND: "Resource not found.",
    FORBIDDEN: "Permission denied. You need edit access for this action.",
    BAD_INVITE_ROLE: "Role must be edit or view.",
    INVITE_CONTACT_REQUIRED:
      "Provide an email, or create an open share link instead.",
    CANNOT_INVITE_OWNER: "That person already owns this property.",
    ALREADY_MEMBER: "That person is already a member.",
    INVITE_ALREADY_PENDING: "An invite is already pending for that contact.",
    INVITE_EXPIRED: "This invite has expired.",
    INVITE_IDENTITY_MISMATCH:
      "Sign in with the email or phone this invite was sent to.",
    INVITE_NOT_PENDING: "This invite is no longer available.",
    CANNOT_DELETE_COMPLETED: "Completed inspections cannot be deleted.",
  };
  res.status(statusForError(err)).json({
    ok: false,
    error: friendly[code] || code,
  });
}

export async function authed(
  req: Req,
  res: Res
): Promise<{
  decoded: admin.auth.DecodedIdToken;
  appProfileId: string;
} | null> {
  try {
    const decoded = await verifyFirebaseUser(req);
    const appProfileId = await resolveProfile(decoded);
    return {decoded, appProfileId};
  } catch (err: unknown) {
    setCorsHeaders(res, req);
    res.status(401).json({error: getErrorMessage(err)});
    return null;
  }
}
