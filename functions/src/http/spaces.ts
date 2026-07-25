/**
 * Space HTTPS handlers.
 */

import {onRequest} from "firebase-functions/v2/https";
import * as domain from "../firestore";
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

export const getSpaces = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.listSpacesForProperty(ctx.appProfileId, propertyId);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const createSpace = onRequest(FN_OPTS, async (req, res) => {
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
      space_type?: string;
      display_name?: string;
      custom_space_type?: string;
    }>(r.body);
    const data = await domain.createSpaceForProperty(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateSpace = onRequest(FN_OPTS, async (req, res) => {
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
    const input = parseBody<{id?: string} & Record<string, unknown>>(r.body);
    if (!input.id) {
      s.status(400).json({error: "Missing id"});
      return;
    }
    const {id, ...patch} = input;
    const data = await domain.updateSpaceForProfile(
      ctx.appProfileId,
      String(id),
      patch
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const deleteSpace = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "DELETE") {
      s.status(405).json({error: "Method not allowed. Use DELETE."});
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
    const ok = await domain.deleteSpaceForProfile(ctx.appProfileId, input.id);
    if (!ok) {
      s.status(404).json({error: "Space not found"});
      return;
    }
    s.status(200).json({ok: true, message: "Space deleted"});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const propertyHasInspections = onRequest(FN_OPTS, async (req, res) => {
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
    const hasInspections = await domain.propertyHasInspections(
      ctx.appProfileId,
      propertyId
    );
    s.status(200).json({hasInspections});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const reorderSpaces = onRequest(FN_OPTS, async (req, res) => {
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
      orderedSpaceIds?: string[];
    }>(r.body);
    if (!input.propertyId || !Array.isArray(input.orderedSpaceIds)) {
      s.status(400).json({error: "Missing propertyId or orderedSpaceIds"});
      return;
    }
    const data = await domain.reorderSpacesForProperty(
      ctx.appProfileId,
      input.propertyId,
      input.orderedSpaceIds
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
