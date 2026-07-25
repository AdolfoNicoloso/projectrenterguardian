/**
 * Public property preview shares (no login required to view).
 * Separate from collaborator invites — no membership is created.
 */

import * as crypto from "crypto";
import {db, nowIso, snapToDoc, type FsDoc} from "./db";
import {requirePropertyAccess} from "./access";
import {createSignedReadUrl, downloadByFileId} from "./storage";

const PUBLIC_SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PUBLIC_PHOTOS = 60;
const DEFAULT_WEB_APP_URL = "https://project-renter-guardian.web.app";

/**
 * @return {string} Web app origin.
 */
function webAppBaseUrl(): string {
  const fromEnv =
    process.env.WEB_APP_URL ||
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    "";
  const trimmed = fromEnv.trim().replace(/\/$/, "");
  return trimmed || DEFAULT_WEB_APP_URL;
}

/**
 * @param {string} token Public share token.
 * @return {string} HTTPS share URL.
 */
function publicShareUrlForToken(token: string): string {
  return `${webAppBaseUrl()}/share/${encodeURIComponent(token)}`;
}

/**
 * @return {string} Opaque token.
 */
function newPublicShareToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * @param {FsDoc} doc Property doc.
 * @return {string} Display label.
 */
function propertyLabel(doc: FsDoc): string {
  const nick = typeof doc.nickname === "string" ? doc.nickname.trim() : "";
  if (nick) return nick;
  return String(doc.address_free_text || "a property");
}

/**
 * @param {FsDoc} doc Share doc.
 * @return {boolean} True when share is usable.
 */
function isActivePublicShare(doc: FsDoc): boolean {
  if (String(doc.status || "") !== "active") return false;
  if (!doc.expires_at) return true;
  return Date.parse(String(doc.expires_at)) > Date.now();
}

/**
 * @param {FsDoc} doc Share doc.
 * @return {Record<string, unknown>} Client share.
 */
function mapPublicShareToClient(doc: FsDoc): Record<string, unknown> {
  return {
    id: doc.id,
    property_id: doc.property_id,
    status: doc.status,
    token: doc.token,
    expires_at: doc.expires_at ?? null,
    date_created: doc.date_created,
    date_updated: doc.date_updated,
    share_url:
      typeof doc.token === "string" ?
        publicShareUrlForToken(doc.token) :
        null,
  };
}

/**
 * Load active public share for a property (if any).
 * @param {string} propertyId Property id.
 * @return {Promise<FsDoc|null>} Active share doc.
 */
async function findActivePublicShareDoc(
  propertyId: string
): Promise<FsDoc | null> {
  const snap = await db()
    .collection("property_public_shares")
    .where("property_id", "==", propertyId)
    .where("status", "==", "active")
    .limit(10)
    .get();
  for (const d of snap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    if (!isActivePublicShare(doc)) {
      await db().collection("property_public_shares").doc(doc.id).update({
        status: "expired",
        date_updated: nowIso(),
      });
      continue;
    }
    return doc;
  }
  return null;
}

/**
 * Create or rotate a public preview share link.
 * @param {string} appProfileId Caller.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>>} Share + message.
 */
export async function createPropertyPublicShare(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown>> {
  const access = await requirePropertyAccess(appProfileId, propertyId, "edit");
  const ts = nowIso();

  // Rotate any existing active shares for this property.
  const existing = await db()
    .collection("property_public_shares")
    .where("property_id", "==", propertyId)
    .where("status", "==", "active")
    .limit(20)
    .get();
  for (const d of existing.docs) {
    await db().collection("property_public_shares").doc(d.id).update({
      status: "revoked",
      date_updated: ts,
    });
  }

  const token = newPublicShareToken();
  const expiresAt = new Date(Date.now() + PUBLIC_SHARE_TTL_MS).toISOString();
  const ref = db().collection("property_public_shares").doc();
  await ref.set({
    property_id: propertyId,
    token,
    status: "active",
    created_by_app_profile_id: appProfileId,
    expires_at: expiresAt,
    date_created: ts,
    date_updated: ts,
  });
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create public share failed");
  }
  const label = propertyLabel(access.property);
  const shareUrl = publicShareUrlForToken(token);
  return {
    ...mapPublicShareToClient(doc),
    share_url: shareUrl,
    share_message:
      `Check out ${label} on Renter Guardian (no account needed): ${shareUrl}`,
  };
}

/**
 * Owner/edit: revoke an active public share.
 * @param {string} appProfileId Caller.
 * @param {string} shareId Share doc id.
 * @return {Promise<boolean>} True when revoked.
 */
export async function revokePropertyPublicShare(
  appProfileId: string,
  shareId: string
): Promise<boolean> {
  const share = snapToDoc(
    await db().collection("property_public_shares").doc(shareId).get()
  );
  if (!share) return false;
  await requirePropertyAccess(
    appProfileId,
    String(share.property_id),
    "edit"
  );
  await db().collection("property_public_shares").doc(shareId).update({
    status: "revoked",
    date_updated: nowIso(),
  });
  return true;
}

/**
 * Active public share for People UI (auth required via caller).
 * @param {string} appProfileId Caller.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>|null>} Active share or null.
 */
export async function getActivePublicShareForProperty(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown> | null> {
  await requirePropertyAccess(appProfileId, propertyId, "view");
  const doc = await findActivePublicShareDoc(propertyId);
  return doc ? mapPublicShareToClient(doc) : null;
}

/**
 * Resolve a public share token to an active share + property.
 * @param {string} token Share token.
 * @return {Promise<{share: FsDoc, property: FsDoc}|null>} Pair or null.
 */
async function resolveActiveShareByToken(
  token: string
): Promise<{share: FsDoc; property: FsDoc} | null> {
  const trimmed = String(token || "").trim();
  if (!trimmed || trimmed.length < 20) return null;

  const snap = await db()
    .collection("property_public_shares")
    .where("token", "==", trimmed)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const share = snapToDoc(snap.docs[0]);
  if (!share) return null;

  if (String(share.status || "") === "active" &&
      share.expires_at &&
      Date.parse(String(share.expires_at)) <= Date.now()) {
    await db().collection("property_public_shares").doc(share.id).update({
      status: "expired",
      date_updated: nowIso(),
    });
    return null;
  }
  if (!isActivePublicShare(share)) return null;

  const property = snapToDoc(
    await db().collection("properties").doc(String(share.property_id)).get()
  );
  if (!property) return null;
  return {share, property};
}

/**
 * Unauthenticated public property preview.
 * @param {string} token Share token.
 * @return {Promise<Record<string, unknown>|null>} Stripped preview.
 */
export async function getPublicPropertyPreviewByToken(
  token: string
): Promise<Record<string, unknown> | null> {
  const resolved = await resolveActiveShareByToken(token);
  if (!resolved) return null;
  const {share, property} = resolved;
  const propertyId = String(property.id);

  const spacesSnap = await db()
    .collection("spaces")
    .where("property_id", "==", propertyId)
    .limit(200)
    .get();
  const spaces = spacesSnap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .sort((a, b) => Number(a.ordinal ?? 999) - Number(b.ordinal ?? 999))
    .map((d) => ({
      id: d.id,
      display_name: d.display_name ?? "",
      space_type: d.space_type ?? "",
      custom_space_type: d.custom_space_type ?? null,
      ordinal: d.ordinal ?? null,
    }));

  const photosSnap = await db()
    .collection("photos")
    .where("property_id", "==", propertyId)
    .limit(MAX_PUBLIC_PHOTOS)
    .get();
  const photoDocs = photosSnap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .filter((d) => typeof d.file === "string" && d.file);

  const photos = await Promise.all(
    photoDocs.map(async (d) => {
      const fileId = String(d.file);
      try {
        const [thumbUrl, displayUrl] = await Promise.all([
          createSignedReadUrl(fileId, "thumb"),
          createSignedReadUrl(fileId, "display"),
        ]);
        return {
          id: d.id,
          file: fileId,
          space: d.space_id || null,
          captured_at: d.captured_at ?? null,
          thumb_url: thumbUrl,
          display_url: displayUrl,
        };
      } catch {
        return {
          id: d.id,
          file: fileId,
          space: d.space_id || null,
          captured_at: d.captured_at ?? null,
          thumb_url: null,
          display_url: null,
        };
      }
    })
  );

  return {
    expires_at: share.expires_at ?? null,
    property: {
      id: property.id,
      display_name: propertyLabel(property),
      address_free_text: property.address_free_text ?? "",
      street: property.street ?? null,
      unit: property.unit ?? null,
      city: property.city ?? null,
      state_code: property.state_code ?? null,
      zip: property.zip ?? null,
      listing_url: property.listing_url ?? null,
      status: property.status ?? null,
    },
    spaces,
    photos,
  };
}

/**
 * Whether a public share token may read a media file for its property.
 * @param {string} token Share token.
 * @param {string} fileId Media file id.
 * @return {Promise<boolean>} Allowed.
 */
export async function canAccessFileViaPublicShare(
  token: string,
  fileId: string
): Promise<boolean> {
  const resolved = await resolveActiveShareByToken(token);
  if (!resolved) return false;
  const propertyId = String(resolved.property.id);

  const photos = await db()
    .collection("photos")
    .where("file", "==", fileId)
    .limit(5)
    .get();
  for (const d of photos.docs) {
    const doc = snapToDoc(d);
    if (doc && String(doc.property_id || "") === propertyId) {
      return true;
    }
  }
  return false;
}

/**
 * Download media for a valid public share token.
 * @param {string} token Share token.
 * @param {string} fileId Media file id.
 * @return {Promise<object|null>} Downloaded file.
 */
export async function downloadPublicShareFile(
  token: string,
  fileId: string
): Promise<Awaited<ReturnType<typeof downloadByFileId>>> {
  const allowed = await canAccessFileViaPublicShare(token, fileId);
  if (!allowed) return null;
  return downloadByFileId(fileId);
}
