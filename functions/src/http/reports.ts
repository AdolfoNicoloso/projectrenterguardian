/**
 * Report HTTPS handlers.
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

export const createReport = onRequest(FN_OPTS, async (req, res) => {
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
      report_type?: string;
      status?: string;
      snapshot_json?: unknown;
      context_state_code?: string;
      disclaimer_version?: string;
    }>(r.body);
    const data = await cms.createReport(ctx.appProfileId, input);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getReports = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await cms.listReportsForProperty(
      ctx.appProfileId,
      propertyId
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getReportById = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await cms.getReportById(ctx.appProfileId, id);
    if (!data) {
      s.status(404).json({error: "Report not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
