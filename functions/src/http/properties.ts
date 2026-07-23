/**
 * Property HTTPS handlers.
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

export const getMyProperties = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await cms.listPropertiesForAppProfile(ctx.appProfileId);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getProperty = onRequest(FN_OPTS, async (req, res) => {
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
    const id = r.query.id;
    if (!id) {
      s.status(400).json({error: "Missing id"});
      return;
    }
    const data = await cms.getPropertyForAppProfile(ctx.appProfileId, id);
    if (!data) {
      s.status(404).json({error: "Property not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const createProperty = onRequest(FN_OPTS, async (req, res) => {
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
      address_free_text?: string;
      lease_start_date?: string;
      lease_end_date?: string | null;
      lease_term?: number | null;
      tour_scheduled_at?: string | null;
      nickname?: string | null;
      state_code?: string | null;
      street?: string | null;
      unit?: string | null;
      city?: string | null;
      zip?: number | null;
      listing_url?: string | null;
      status?: string | null;
    }>(r.body);
    if (!input.address_free_text) {
      s.status(400).json({
        error: "Missing required field: address_free_text",
      });
      return;
    }
    const status = String(input.status || "active").toLowerCase();
    // Lease / tour time optional at create; set later on overview.
    const data = await cms.createPropertyWithDefaultSpaces(ctx.appProfileId, {
      address_free_text: input.address_free_text,
      lease_start_date: input.lease_start_date,
      lease_end_date: input.lease_end_date,
      lease_term: input.lease_term,
      tour_scheduled_at: input.tour_scheduled_at,
      nickname: input.nickname,
      state_code: input.state_code,
      street: input.street,
      unit: input.unit,
      city: input.city,
      zip: input.zip,
      listing_url: input.listing_url,
      status,
    });
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateProperty = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await cms.updatePropertyForAppProfile(
      ctx.appProfileId,
      String(id),
      patch
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const deleteProperty = onRequest(FN_OPTS, async (req, res) => {
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
    const input = parseBody<{propertyId?: string}>(r.body);
    if (!input.propertyId) {
      s.status(400).json({error: "Missing propertyId"});
      return;
    }
    const ok = await cms.deletePropertyCascade(
      ctx.appProfileId,
      input.propertyId
    );
    if (!ok) {
      s.status(404).json({error: "Property not found"});
      return;
    }
    s.status(200).json({ok: true, message: "Property deleted"});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
