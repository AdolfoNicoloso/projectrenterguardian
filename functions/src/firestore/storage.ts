/**
 * Firebase Storage helpers + media_files registry.
 */

import {randomUUID} from "node:crypto";
import * as admin from "firebase-admin";
import {db, nowIso, snapToDoc} from "./db";

export interface DownloadedFile {
  contentType: string;
  buffer: Buffer;
  filename: string;
}

export interface SignedUploadSession {
  fileId: string;
  uploadUrl: string;
  storagePath: string;
  contentType: string;
}

export type MediaVariant = "thumb" | "display" | "original";

/** Soft limit for base64-through-function uploads (HTTP body ~32MB). */
export const MAX_BASE64_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Direct signed-URL uploads (videos / images). */
export const MAX_DIRECT_UPLOAD_BYTES = 200 * 1024 * 1024;

const MEDIA_BUCKET = "project-renter-guardian-media";
const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour

/** @return {admin.storage.Bucket} Media uploads bucket. */
function mediaBucket() {
  return admin.storage().bucket(MEDIA_BUCKET);
}

let corsEnsurePromise: Promise<void> | null = null;

/**
 * Ensures browser PUT/GET uploads work (signed URL from web).
 * Idempotent; runs once per cold start.
 * @return {Promise<void>}
 */
async function ensureMediaBucketCors(): Promise<void> {
  if (!corsEnsurePromise) {
    corsEnsurePromise = mediaBucket()
      .setCorsConfiguration([
        {
          origin: ["*"],
          method: ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
          responseHeader: [
            "Content-Type",
            "Content-Length",
            "Content-Range",
            "x-goog-resumable",
            "x-goog-content-length-range",
            "Content-Disposition",
            "Authorization",
            "Origin",
            "*",
          ],
          maxAgeSeconds: 3600,
        },
      ])
      .then(() => undefined)
      .catch((err) => {
        console.warn("[ensureMediaBucketCors]", err);
        corsEnsurePromise = null;
      });
  }
  await corsEnsurePromise;
}

/**
 * @param {string} filename Raw filename.
 * @return {string} Storage-safe filename.
 */
function safeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "_") || "upload.bin";
}

/**
 * Uploads bytes to Storage and registers a media_files document.
 * Bucket: project-renter-guardian-media
 * Thumb/display paths are optional; getFile falls back to the original.
 * @param {string} appProfileId Owner profile id.
 * @param {Buffer} fileBuffer Raw bytes.
 * @param {string} filename Original filename.
 * @param {string} mimeType MIME type.
 * @return {Promise<string>} Opaque file id for photo.file / getFile.
 */
export async function uploadBinary(
  appProfileId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const fileId = randomUUID();
  const safeName = safeFilename(filename);
  const storagePath = `uploads/${appProfileId}/${fileId}_${safeName}`;
  const file = mediaBucket().file(storagePath);
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        app_profile_id: appProfileId,
        original_filename: filename,
      },
    },
    resumable: false,
  });

  const ts = nowIso();
  await db().collection("media_files").doc(fileId).set({
    storage_path: storagePath,
    content_type: mimeType,
    filename: safeName,
    app_profile_id: appProfileId,
    size: fileBuffer.length,
    upload_status: "ready",
    date_created: ts,
    date_updated: ts,
  });
  return fileId;
}

/**
 * Creates a pending media_files row and a resumable upload session URI
 * so the client can PUT bytes directly to GCS.
 * @param {string} appProfileId Owner profile id.
 * @param {string} filename Original filename.
 * @param {string} mimeType MIME type.
 * @param {number|undefined} sizeBytes Declared size (optional).
 * @return {Promise<SignedUploadSession>} file id + PUT URL.
 */
export async function createSignedUploadSession(
  appProfileId: string,
  filename: string,
  mimeType: string,
  sizeBytes?: number
): Promise<SignedUploadSession> {
  const fileId = randomUUID();
  const safeName = safeFilename(filename);
  const storagePath = `uploads/${appProfileId}/${fileId}_${safeName}`;
  await ensureMediaBucketCors();
  const file = mediaBucket().file(storagePath);
  const contentType = mimeType || "application/octet-stream";

  const [uploadUrl] = await file.createResumableUpload({
    metadata: {
      contentType,
      metadata: {
        app_profile_id: appProfileId,
        original_filename: filename,
      },
    },
  });

  const ts = nowIso();
  await db().collection("media_files").doc(fileId).set({
    storage_path: storagePath,
    content_type: contentType,
    filename: safeName,
    app_profile_id: appProfileId,
    size: typeof sizeBytes === "number" ? sizeBytes : 0,
    upload_status: "pending",
    date_created: ts,
    date_updated: ts,
  });

  return {fileId, uploadUrl, storagePath, contentType};
}

/**
 * Confirms a signed upload landed in Storage and marks the media file ready.
 * @param {string} appProfileId Caller profile id.
 * @param {string} fileId Media file id.
 * @return {Promise<boolean>} True when ready; false when missing / not owned.
 */
export async function finalizeSignedUploadForProfile(
  appProfileId: string,
  fileId: string
): Promise<boolean> {
  if (!fileId) {
    return false;
  }
  const ref = db().collection("media_files").doc(fileId);
  const snap = await ref.get();
  const doc = snapToDoc(snap);
  if (!doc || doc.app_profile_id !== appProfileId) {
    return false;
  }
  if (typeof doc.storage_path !== "string") {
    return false;
  }
  const file = mediaBucket().file(doc.storage_path);
  const [exists] = await file.exists();
  if (!exists) {
    return false;
  }
  let size = typeof doc.size === "number" ? doc.size : 0;
  try {
    const [metadata] = await file.getMetadata();
    if (metadata.size) {
      size = Number(metadata.size);
    }
  } catch (err) {
    console.warn("[finalizeSignedUpload] metadata:", err);
  }

  await ref.update({
    upload_status: "ready",
    size,
    date_updated: nowIso(),
  });
  return true;
}

/**
 * Resolves the storage path for a media variant (falls back to original).
 * @param {Record<string, unknown>} doc media_files doc.
 * @param {MediaVariant} variant Requested variant.
 * @return {{path: string, contentType: string, filename: string}|null}
 */
function resolveVariantPath(
  doc: Record<string, unknown>,
  variant: MediaVariant
): {path: string; contentType: string; filename: string} | null {
  if (typeof doc.storage_path !== "string") {
    return null;
  }
  const originalPath = doc.storage_path;
  const originalType = String(doc.content_type || "application/octet-stream");
  const filename = String(doc.filename || "file");

  if (variant === "thumb" && typeof doc.thumb_path === "string") {
    return {
      path: doc.thumb_path,
      contentType: "image/jpeg",
      filename: filename.replace(/\.[^.]+$/, "") + "_thumb.jpg",
    };
  }
  if (variant === "display" && typeof doc.display_path === "string") {
    return {
      path: doc.display_path,
      contentType: "image/jpeg",
      filename: filename.replace(/\.[^.]+$/, "") + "_display.jpg",
    };
  }
  return {path: originalPath, contentType: originalType, filename};
}

/**
 * Creates a short-lived V4 signed GET URL for a media file variant.
 * Falls back to null when signing is unavailable (caller may proxy bytes).
 * Missing thumb/display paths fall back to the original — do not generate
 * variants on the read path (download+sharp OOMs 256MiB under grid load).
 * @param {string} fileId Media file id.
 * @param {MediaVariant} variant thumb | display | original.
 * @return {Promise<string|null>} Signed URL or null.
 */
export async function createSignedReadUrl(
  fileId: string,
  variant: MediaVariant = "original"
): Promise<string | null> {
  const snap = await db().collection("media_files").doc(fileId).get();
  const doc = snapToDoc(snap);
  if (!doc) {
    return null;
  }

  const resolved = resolveVariantPath(doc, variant);
  if (!resolved) {
    return null;
  }
  await ensureMediaBucketCors();
  const file = mediaBucket().file(resolved.path);
  const [exists] = await file.exists();
  if (!exists) {
    // Variant missing — try original.
    if (variant !== "original" && typeof doc.storage_path === "string") {
      return createSignedReadUrl(fileId, "original");
    }
    return null;
  }
  try {
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
      responseDisposition:
        `inline; filename="${resolved.filename.replace(/"/g, "")}"`,
      responseType: resolved.contentType,
    });
    return url;
  } catch (err) {
    console.warn("[createSignedReadUrl] sign failed:", err);
    return null;
  }
}

/**
 * Downloads a registered media file (or variant) from Storage.
 * Missing thumb/display paths fall back to the original file.
 * @param {string} fileId Media file id.
 * @param {MediaVariant} variant thumb | display | original.
 * @return {Promise<DownloadedFile|null>} Bytes + metadata or null.
 */
export async function downloadByFileId(
  fileId: string,
  variant: MediaVariant = "original"
): Promise<DownloadedFile | null> {
  const snap = await db().collection("media_files").doc(fileId).get();
  const doc = snapToDoc(snap);
  if (!doc) {
    return null;
  }
  const resolved = resolveVariantPath(doc, variant);
  if (!resolved) {
    return null;
  }
  let file = mediaBucket().file(resolved.path);
  let [exists] = await file.exists();
  let contentType = resolved.contentType;
  let filename = resolved.filename;
  if (
    !exists &&
    variant !== "original" &&
    typeof doc.storage_path === "string"
  ) {
    file = mediaBucket().file(doc.storage_path);
    [exists] = await file.exists();
    contentType = String(doc.content_type || "application/octet-stream");
    filename = String(doc.filename || fileId);
  }
  if (!exists) {
    return null;
  }
  const [buffer] = await file.download();
  return {
    buffer,
    contentType,
    filename,
  };
}

/**
 * Deletes a Storage object and media_files doc if present.
 * @param {string} fileId Media file id.
 * @return {Promise<void>}
 */
export async function deleteMediaFile(fileId: string): Promise<void> {
  if (!fileId) {
    return;
  }
  const ref = db().collection("media_files").doc(fileId);
  const snap = await ref.get();
  const doc = snapToDoc(snap);
  if (doc) {
    const paths = [
      typeof doc.storage_path === "string" ? doc.storage_path : null,
      typeof doc.thumb_path === "string" ? doc.thumb_path : null,
      typeof doc.display_path === "string" ? doc.display_path : null,
    ].filter((p): p is string => !!p);
    for (const path of paths) {
      try {
        await mediaBucket().file(path).delete({ignoreNotFound: true});
      } catch (err) {
        console.warn("[deleteMediaFile] storage delete:", err);
      }
    }
  }
  if (snap.exists) {
    await ref.delete();
  }
}

/**
 * Deletes a media file only if the caller uploaded it (orphan cleanup).
 * @param {string} appProfileId Caller profile id.
 * @param {string} fileId Media file id.
 * @return {Promise<boolean>} True when deleted; false when missing / not owned.
 */
export async function deleteUploadedFileForProfile(
  appProfileId: string,
  fileId: string
): Promise<boolean> {
  if (!fileId) {
    return false;
  }
  const snap = await db().collection("media_files").doc(fileId).get();
  const doc = snapToDoc(snap);
  if (!doc || doc.app_profile_id !== appProfileId) {
    return false;
  }
  await deleteMediaFile(fileId);
  return true;
}
