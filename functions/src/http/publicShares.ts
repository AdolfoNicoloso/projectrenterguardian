/**
 * Public property share HTTPS handlers.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as domain from "../firestore";
import {
  FN_OPTS,
  MEDIA_READ_FN_OPTS,
  Req,
  Res,
  authed,
  getErrorMessage,
  handleCorsPreflight,
  parseBody,
  sendErr,
  setCorsHeaders,
} from "./helpers";

/** Auth: create / rotate a no-login preview link. */
export const createPropertyPublicShare = onRequest(
  FN_OPTS,
  async (req, res) => {
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
      const input = parseBody<{propertyId?: string}>(r.body);
      if (!input.propertyId) {
        s.status(400).json({error: "Missing propertyId"});
        return;
      }
      const data = await domain.createPropertyPublicShare(
        ctx.appProfileId,
        input.propertyId
      );
      s.status(200).json({data});
    } catch (err: unknown) {
      sendErr(s, r, err);
    }
  }
);

/** Auth: revoke a public preview link. */
export const revokePropertyPublicShare = onRequest(
  FN_OPTS,
  async (req, res) => {
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
      const input = parseBody<{shareId?: string}>(r.body);
      const shareId = input.shareId || r.query.shareId;
      if (!shareId) {
        s.status(400).json({error: "Missing shareId"});
        return;
      }
      const ok = await domain.revokePropertyPublicShare(
        ctx.appProfileId,
        shareId
      );
      if (!ok) {
        s.status(404).json({error: "Share not found"});
        return;
      }
      s.status(200).json({ok: true});
    } catch (err: unknown) {
      sendErr(s, r, err);
    }
  }
);

/** Public: property preview for a share token (no login). */
export const getPublicPropertyPreview = onRequest(
  MEDIA_READ_FN_OPTS,
  async (req, res) => {
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
      const token = r.query.token;
      if (!token) {
        s.status(400).json({error: "Missing token"});
        return;
      }
      const data = await domain.getPublicPropertyPreviewByToken(token);
      if (!data) {
        // Uniform not-found (invalid, revoked, or expired).
        s.status(404).json({error: "Share not found"});
        return;
      }
      s.status(200).json({data});
    } catch (err: unknown) {
      sendErr(s, r, err);
    }
  }
);

/** Public: media bytes for a share token (no login). */
export const getPublicFile = onRequest(MEDIA_READ_FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "GET") {
      s.status(405).send("Method not allowed");
      return;
    }
    const token = r.query.token || r.query.shareToken;
    const fileId = r.query.fileId;
    if (!token || !fileId) {
      s.status(400).send("Missing token or fileId");
      return;
    }
    const rawVariant = String(r.query.variant || "original").toLowerCase();
    const variant: domain.MediaVariant =
      rawVariant === "thumb" || rawVariant === "display" ?
        rawVariant :
        "original";

    const allowed = await domain.canAccessFileViaPublicShare(token, fileId);
    if (!allowed) {
      s.status(403).send("Forbidden");
      return;
    }

    const signedUrl = await domain.createSignedReadUrl(fileId, variant);
    if (signedUrl) {
      s.setHeader("Cache-Control", "private, max-age=300");
      s.redirect(302, signedUrl);
      return;
    }

    const downloaded = await domain.downloadByFileId(fileId, variant);
    if (!downloaded) {
      s.status(404).send("Not found");
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
    console.error("[getPublicFile]", getErrorMessage(err));
    s.status(500).send("Error");
  }
});
