/**
 * In-app notifications HTTPS handlers.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as cms from "../firestore";
import {
  FN_OPTS,
  Req,
  Res,
  authed,
  handleCorsPreflight,
  parseBody,
  sendErr,
  setCorsHeaders,
} from "./helpers";

export const listMyNotifications = onRequest(FN_OPTS, async (req, res) => {
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
    const limitRaw = r.query.limit;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const data = await cms.listNotificationsForProfile(ctx.appProfileId, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const markNotificationRead = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST" && r.method !== "PATCH") {
      s.status(405).json({error: "Method not allowed. Use POST or PATCH."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{notificationId?: string; all?: boolean}>(r.body);
    if (input.all) {
      const marked = await cms.markAllNotificationsRead(ctx.appProfileId);
      s.status(200).json({data: {marked}});
      return;
    }
    if (!input.notificationId) {
      s.status(400).json({error: "Missing notificationId"});
      return;
    }
    const data = await cms.markNotificationRead(
      ctx.appProfileId,
      input.notificationId
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
