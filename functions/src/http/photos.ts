/**
 * Photo, file, and assignment HTTPS handlers.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as domain from "../firestore";
import {
  FN_OPTS,
  UPLOAD_FN_OPTS,
  MEDIA_READ_FN_OPTS,
  Req,
  Res,
  authed,
  extractBearerToken,
  getErrorMessage,
  handleCorsPreflight,
  parseBody,
  resolveProfile,
  sendErr,
  sendImageError,
  setCorsHeaders,
} from "./helpers";

export const getPhotos = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "GET") {
      s.status(405).json({error: "Method not allowed. Use GET."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const propertyId = r.query.propertyId;
    if (!propertyId) {
      s.status(400).json({error: "Missing propertyId"});
      return;
    }
    const data = await domain.listPhotosForProperty(
      ctx.appProfileId,
      propertyId,
      r.query.spaceId,
      r.query.status,
      r.query.fields
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getPhoto = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "GET") {
      s.status(405).json({error: "Method not allowed. Use GET."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const photoId = r.query.photoId;
    if (!photoId) {
      s.status(400).json({error: "Missing photoId"});
      return;
    }
    const data = await domain.getPhotoForProfile(ctx.appProfileId, photoId);
    if (!data) {
      s.status(404).json({error: "Photo not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const uploadFile = onRequest(UPLOAD_FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{
      uri?: string;
      type?: string;
      name?: string;
      base64?: string;
      propertyId?: string;
    }>(r.body);
    if (!input.name || (!input.uri && !input.base64)) {
      s.status(400).json({
        error: "Missing required fields: name, and either uri or base64",
      });
      return;
    }

    // Property-scoped uploads require edit (owner/edit). View-only → 403.
    if (input.propertyId) {
      await domain.requirePropertyAccess(
        ctx.appProfileId,
        input.propertyId,
        "edit"
      );
    }

    let fileBuffer: Buffer;
    let mimeType = input.type || "image/jpeg";

    if (input.base64) {
      if (input.base64.startsWith("data:")) {
        const mimeMatch = input.base64.match(/^data:([^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
        const base64Data = input.base64.replace(/^data:[^;]*;base64,/, "");
        fileBuffer = Buffer.from(base64Data, "base64");
      } else {
        fileBuffer = Buffer.from(input.base64, "base64");
      }
    } else if (input.uri && input.uri.startsWith("data:")) {
      const base64Data = input.uri.replace(/^data:.*,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
      const mimeMatch = input.uri.match(/^data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else {
      s.status(400).json({
        error:
          "File upload requires base64 encoding. " +
          "Please convert the file to base64 before uploading.",
      });
      return;
    }

    const isHeic =
      mimeType.includes("heic") ||
      mimeType.includes("heif") ||
      mimeType === "image/heic" ||
      mimeType === "image/heif";
    if (isHeic) {
      s.status(400).json({
        error: "HEIC/HEIF not supported. Convert to JPEG on the client.",
      });
      return;
    }

    const isVideo = mimeType.toLowerCase().startsWith("video/");
    if (isVideo) {
      s.status(400).json({
        error:
          "Videos must use createMediaUpload (direct Storage upload). " +
          "Base64 upload is limited to images.",
      });
      return;
    }

    // HTTP body limit ~32MB; base64 expands ~4/3 — keep under 15MB raw.
    if (fileBuffer.length > domain.MAX_BASE64_UPLOAD_BYTES) {
      s.status(400).json({
        error:
          "File exceeds 15 MB limit for image upload. " +
          "Use a smaller photo or compress before uploading.",
      });
      return;
    }

    const id = await domain.uploadBinary(
      ctx.appProfileId,
      fileBuffer,
      input.name,
      mimeType
    );
    s.status(200).json({data: {id}});
  } catch (err: unknown) {
    console.error("[uploadFile]", getErrorMessage(err));
    sendErr(s, r, err);
  }
});

/**
 * Start a direct-to-Storage upload (images, videos, large files).
 * Returns a GCS resumable upload session URL + media file id
 * (not a V4 signed PUT — see createSignedUploadSession).
 */
export const createMediaUpload = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{
      name?: string;
      type?: string;
      propertyId?: string;
      size?: number;
    }>(r.body);
    if (!input.name || !input.type) {
      s.status(400).json({error: "Missing required fields: name, type"});
      return;
    }
    if (input.propertyId) {
      await domain.requirePropertyAccess(
        ctx.appProfileId,
        input.propertyId,
        "edit"
      );
    }

    const mimeType = String(input.type);
    const isVideo = mimeType.toLowerCase().startsWith("video/");
    const isPdf = mimeType.toLowerCase() === "application/pdf";
    const maxBytes = isVideo ?
      domain.MAX_DIRECT_UPLOAD_BYTES :
      isPdf ?
        25 * 1024 * 1024 :
        domain.MAX_BASE64_UPLOAD_BYTES;
    if (
      typeof input.size === "number" &&
      Number.isFinite(input.size) &&
      input.size > maxBytes
    ) {
      s.status(400).json({
        error: isVideo ?
          "Video exceeds 200 MB limit" :
          isPdf ?
            "PDF exceeds 25 MB limit" :
            "File exceeds size limit",
      });
      return;
    }

    const session = await domain.createSignedUploadSession(
      ctx.appProfileId,
      input.name,
      mimeType,
      typeof input.size === "number" ? input.size : undefined
    );
    s.status(200).json({
      data: {
        fileId: session.fileId,
        uploadUrl: session.uploadUrl,
        contentType: session.contentType,
      },
    });
  } catch (err: unknown) {
    console.error("[createMediaUpload]", getErrorMessage(err));
    sendErr(s, r, err);
  }
});

/**
 * Confirm a direct GCS upload finished and mark media_files ready.
 * Thumb/display variants are generated lazily on first read.
 */
export const finalizeMediaUpload = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{fileId?: string}>(r.body);
    if (!input.fileId) {
      s.status(400).json({error: "Missing fileId"});
      return;
    }
    const ok = await domain.finalizeSignedUploadForProfile(
      ctx.appProfileId,
      input.fileId
    );
    if (!ok) {
      s.status(404).json({
        error: "Upload not found or file missing from Storage",
      });
      return;
    }
    s.status(200).json({ok: true, data: {fileId: input.fileId}});
  } catch (err: unknown) {
    console.error("[finalizeMediaUpload]", getErrorMessage(err));
    sendErr(s, r, err);
  }
});

/**
 * Best-effort delete of an orphaned media file the caller uploaded
 * (e.g. createPhoto failed after uploadFile succeeded).
 */
export const deleteUploadedFile = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST" && r.method !== "DELETE") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{fileId?: string}>(r.body);
    if (!input.fileId) {
      s.status(400).json({error: "Missing fileId"});
      return;
    }
    const ok = await domain.deleteUploadedFileForProfile(
      ctx.appProfileId,
      input.fileId
    );
    if (!ok) {
      s.status(404).json({error: "File not found"});
      return;
    }
    s.status(200).json({ok: true});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const createPhoto = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{
      property?: string;
      space?: string;
      file?: string;
      captured_at?: string;
      exif_datetime_original?: string;
      assignment_status?: string;
      notes?: string;
      notes_entries?: unknown[];
    }>(r.body);
    const data = await domain.createPhoto(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updatePhoto = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "PATCH") {
      s.status(405).json({error: "Method not allowed. Use PATCH."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{
      id?: string;
      property?: string;
      space?: string;
      file?: string;
      assignment_status?: string;
      notes?: string;
      notes_entries?: unknown[];
    }>(r.body);
    const data = await domain.updatePhoto(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const deletePhoto = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST" && r.method !== "DELETE") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{id?: string}>(r.body);
    if (!input.id) {
      s.status(400).json({error: "Missing id"});
      return;
    }
    const ok = await domain.deletePhotoForProfile(ctx.appProfileId, input.id);
    if (!ok) {
      s.status(404).json({error: "Photo not found"});
      return;
    }
    s.status(200).json({ok: true, message: "Photo deleted"});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getFile = onRequest(MEDIA_READ_FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "GET") {
      sendImageError(s, r, 405);
      return;
    }
    const fileId = r.query.fileId;
    if (!fileId) {
      sendImageError(s, r, 400);
      return;
    }

    const authHeader = r.get("Authorization") || "";
    const idTokenFromHeader = extractBearerToken(authHeader);
    const idTokenFromQuery = r.query.token;
    const idToken = idTokenFromHeader || idTokenFromQuery;
    if (!idToken) {
      sendImageError(s, r, 401);
      return;
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      sendImageError(s, r, 401);
      return;
    }

    const appProfileId = await resolveProfile(decoded);
    const allowed = await domain.canAccessFile(appProfileId, fileId);
    if (!allowed) {
      sendImageError(s, r, 403);
      return;
    }

    const rawVariant = String(r.query.variant || "original").toLowerCase();
    const variant: domain.MediaVariant =
      rawVariant === "thumb" || rawVariant === "display" ?
        rawVariant :
        "original";

    // Prefer short-lived signed GCS URL (no CF byte proxy).
    const signedUrl = await domain.createSignedReadUrl(fileId, variant);
    if (signedUrl) {
      s.setHeader("Cache-Control", "private, max-age=300");
      s.redirect(302, signedUrl);
      return;
    }

    // Fallback: stream full buffer through the function (signing unavailable).
    const downloaded = await domain.downloadByFileId(fileId, variant);
    if (!downloaded) {
      sendImageError(s, r, 404);
      return;
    }

    s.setHeader("Content-Type", downloaded.contentType);
    s.setHeader(
      "Content-Disposition",
      `inline; filename="${downloaded.filename.replace(/"/g, "")}"`
    );
    s.setHeader("Cache-Control", "private, max-age=3600");
    s.status(200).send(downloaded.buffer);
  } catch (err: unknown) {
    console.error("[getFile]", getErrorMessage(err));
    sendImageError(s, r, 500);
  }
});

export const createAssignment = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{photo?: string; space?: string}>(r.body);
    if (!input.photo || !input.space) {
      s.status(400).json({error: "Missing photo or space"});
      return;
    }
    const data = await domain.createAssignment(
      ctx.appProfileId,
      input.photo,
      input.space
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const reorderPhotos = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST" && r.method !== "PATCH") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{
      propertyId?: string;
      /** Space id, or omit/empty for unassigned tray. */
      spaceId?: string | null;
      orderedPhotoIds?: string[];
    }>(r.body);
    if (!input.propertyId || !Array.isArray(input.orderedPhotoIds)) {
      s.status(400).json({error: "Missing propertyId or orderedPhotoIds"});
      return;
    }
    const data = await domain.reorderPhotosForProperty(
      ctx.appProfileId,
      input.propertyId,
      input.spaceId || "",
      input.orderedPhotoIds
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getAssignments = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "GET") {
      s.status(405).json({error: "Method not allowed. Use GET."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const photoId = r.query.photoId;
    if (!photoId) {
      s.status(400).json({error: "Missing photoId"});
      return;
    }
    const data = await domain.listAssignmentsForPhoto(
      ctx.appProfileId,
      photoId
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
