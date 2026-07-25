/**
 * Profile and preferences HTTPS handlers.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as domain from "../firestore";
import {
  FN_OPTS,
  Req,
  Res,
  authed,
  displayNameFromToken,
  getErrorMessage,
  handleCorsPreflight,
  parseBody,
  sendErr,
  setCorsHeaders,
  verifyFirebaseUser,
} from "./helpers";

export const smokeTest = onRequest(FN_OPTS, async (req, res) => {
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
    const decoded = await verifyFirebaseUser(r);
    const probe = await domain.getOrCreateAppProfile({
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: displayNameFromToken(decoded),
    });
    s.status(200).json({
      ok: true,
      uid: decoded.uid,
      app_profile_id: probe,
      backend: "firestore",
    });
  } catch (err: unknown) {
    s.status(500).json({ok: false, error: getErrorMessage(err)});
  }
});

export const bootstrapProfile = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST" && r.method !== "GET") {
      s.status(405).json({error: "Method not allowed. Use POST or GET."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    s.status(200).json({app_profile_id: ctx.appProfileId});
  } catch (err: unknown) {
    s.status(500).json({ok: false, error: getErrorMessage(err)});
  }
});

export const getAppProfile = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.getAppProfile(ctx.appProfileId);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateAppProfile = onRequest(FN_OPTS, async (req, res) => {
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
      name?: string;
      onboarding_completed?: boolean;
    }>(r.body);
    const data = await domain.updateAppProfile(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getUserPreferences = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.getUserPreferences(ctx.appProfileId);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateUserPreferences = onRequest(FN_OPTS, async (req, res) => {
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
      theme_preference?: string;
      preferred_language?: string;
    }>(r.body);
    const data = await domain.upsertUserPreferences(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

/**
 * Permanently deletes the caller's Firestore data, Storage,
 * and Auth user.
 *
 * Important: do NOT use authed()/getOrCreateAppProfile here — that can
 * create a fresh empty profile and delete the wrong (empty) records while
 * leaving the real app_profiles / properties / preferences behind.
 */
export const deleteAccount = onRequest(
  {...FN_OPTS, timeoutSeconds: 300, memory: "512MiB"},
  async (req, res) => {
    const r = req as unknown as Req;
    const s = res as unknown as Res;
    if (handleCorsPreflight(r, s)) {
      return;
    }
    setCorsHeaders(s, r);
    try {
      if (r.method !== "POST" && r.method !== "DELETE") {
        s.status(405).json({
          error: "Method not allowed. Use POST or DELETE.",
        });
        return;
      }
      const decoded = await verifyFirebaseUser(r);
      // Best-effort known profile id (may be missing on legacy rows).
      let knownProfileId: string | undefined;
      try {
        const mapped = await domain.findAppProfileByFirebaseUid(decoded.uid);
        if (mapped && typeof mapped.id === "string") {
          knownProfileId = mapped.id;
        }
      } catch (err: unknown) {
        console.warn(
          "[deleteAccount] profile lookup failed",
          getErrorMessage(err)
        );
      }
      const result = await domain.deleteAccountCompletely(
        decoded.uid,
        knownProfileId
      );
      s.status(200).json({ok: true, ...result});
    } catch (err: unknown) {
      sendErr(s, r, err);
    }
  }
);
