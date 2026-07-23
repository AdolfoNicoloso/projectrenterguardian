/**
 * Firebase Storage helpers + media_files registry.
 */

import {randomUUID} from "node:crypto";
import * as admin from "firebase-admin";
import {db, nowIso, snapToDoc} from "./db";

export interface DownloadedFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Uploads bytes to Storage and registers a media_files document.
 * Bucket: project-renter-guardian-media
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
  const safeName = filename.replace(/[^\w.-]+/g, "_") || "upload.bin";
  const storagePath = `uploads/${appProfileId}/${fileId}_${safeName}`;
  const bucket = admin.storage().bucket("project-renter-guardian-media");
  const file = bucket.file(storagePath);
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
    date_created: ts,
    date_updated: ts,
  });
  return fileId;
}

/**
 * Downloads a registered media file from Storage.
 * @param {string} fileId Media file id.
 * @return {Promise<DownloadedFile|null>} Bytes + metadata or null.
 */
export async function downloadByFileId(
  fileId: string
): Promise<DownloadedFile | null> {
  const snap = await db().collection("media_files").doc(fileId).get();
  const doc = snapToDoc(snap);
  if (!doc || typeof doc.storage_path !== "string") {
    return null;
  }
  const bucket = admin.storage().bucket("project-renter-guardian-media");
  const file = bucket.file(doc.storage_path);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  const [buffer] = await file.download();
  return {
    buffer,
    contentType: String(doc.content_type || "application/octet-stream"),
    filename: String(doc.filename || fileId),
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
  if (doc && typeof doc.storage_path === "string") {
    try {
      await admin.storage().bucket("project-renter-guardian-media")
        .file(doc.storage_path).delete({
          ignoreNotFound: true,
        });
    } catch (err) {
      console.warn("[deleteMediaFile] storage delete:", err);
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
