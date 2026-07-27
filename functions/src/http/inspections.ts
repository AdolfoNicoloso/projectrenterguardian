/**
 * Inspection HTTPS handlers.
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

export const createInspection = onRequest(FN_OPTS, async (req, res) => {
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
      property_id?: string;
      inspection_type?: string;
    }>(r.body);
    if (!input.property_id || !input.inspection_type) {
      s.status(400).json({
        error: "Missing required fields: property_id, inspection_type",
      });
      return;
    }
    const data = await domain.createInspection(
      ctx.appProfileId,
      input.property_id,
      input.inspection_type
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getInspections = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.listInspections(ctx.appProfileId, r.query.status);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getInspectionById = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.getInspectionById(ctx.appProfileId, id);
    if (!data) {
      s.status(404).json({error: "Inspection not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getInspectionSteps = onRequest(FN_OPTS, async (req, res) => {
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
    const inspectionId = r.query.inspectionId;
    if (!inspectionId) {
      s.status(400).json({error: "Missing inspectionId"});
      return;
    }
    const data = await domain.listInspectionSteps(
      ctx.appProfileId,
      inspectionId
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getInspectionStep = onRequest(FN_OPTS, async (req, res) => {
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
    const inspectionId = r.query.inspectionId;
    const stepKey = r.query.stepKey;
    if (!inspectionId || !stepKey) {
      s.status(400).json({error: "Missing inspectionId or stepKey"});
      return;
    }
    const data = await domain.getInspectionStep(
      ctx.appProfileId,
      inspectionId,
      stepKey
    );
    if (!data) {
      s.status(404).json({error: "Step not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateInspectionStep = onRequest(FN_OPTS, async (req, res) => {
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
      payload_json?: unknown;
      inspection_step_status?: string;
    }>(r.body);
    if (!input.id) {
      s.status(400).json({error: "Missing id"});
      return;
    }
    const data = await domain.updateInspectionStep(ctx.appProfileId, input.id, {
      payload_json: input.payload_json,
      inspection_step_status: input.inspection_step_status,
    });
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updateInspection = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.updateInspection(
      ctx.appProfileId,
      String(id),
      patch
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const deleteInspection = onRequest(FN_OPTS, async (req, res) => {
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
    const ok = await domain.deleteInspectionForProfile(
      ctx.appProfileId,
      input.id
    );
    if (!ok) {
      s.status(404).json({error: "Inspection not found"});
      return;
    }
    s.status(200).json({ok: true, message: "Inspection deleted"});
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CANNOT_DELETE_COMPLETED") {
      s.status(400).json({
        error: "Completed inspections cannot be deleted",
      });
      return;
    }
    sendErr(s, r, err);
  }
});
