/**
 * Property sharing / invite HTTPS handlers.
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

export const createPropertyInvite = onRequest(FN_OPTS, async (req, res) => {
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
      propertyId?: string;
      role?: string;
      email?: string;
      phone?: string;
      mode?: string;
    }>(r.body);
    if (!input.propertyId || !input.role) {
      s.status(400).json({error: "Missing propertyId or role"});
      return;
    }
    const data = await domain.createPropertyInvite(ctx.appProfileId, {
      propertyId: input.propertyId,
      role: input.role,
      email: input.email,
      phone: input.phone,
      mode: input.mode,
    });
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const listPropertyMembers = onRequest(FN_OPTS, async (req, res) => {
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
    const data = await domain.listPropertyPeople(ctx.appProfileId, propertyId);
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const getPropertyInvitePreview = onRequest(FN_OPTS, async (req, res) => {
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
    // Auth required to reduce token fishing; identity match is on accept.
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const data = await domain.getInvitePreviewByToken(token);
    if (!data) {
      s.status(404).json({error: "Invite not found"});
      return;
    }
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const acceptPropertyInvite = onRequest(FN_OPTS, async (req, res) => {
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
    const input = parseBody<{token?: string}>(r.body);
    if (!input.token) {
      s.status(400).json({error: "Missing token"});
      return;
    }
    const phone =
      (ctx.decoded as {phone_number?: string}).phone_number ?? null;
    const data = await domain.acceptPropertyInvite(
      ctx.appProfileId,
      input.token,
      {email: ctx.decoded.email ?? null, phone}
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const updatePropertyMemberRole = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "PATCH" && r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use PATCH."});
      return;
    }
    const ctx = await authed(r, s);
    if (!ctx) {
      return;
    }
    const input = parseBody<{memberId?: string; role?: string}>(r.body);
    if (!input.memberId || !input.role) {
      s.status(400).json({error: "Missing memberId or role"});
      return;
    }
    const data = await domain.updatePropertyMemberRole(
      ctx.appProfileId,
      input.memberId,
      input.role
    );
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const revokePropertyMember = onRequest(FN_OPTS, async (req, res) => {
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
    const input = parseBody<{memberId?: string}>(r.body);
    const memberId = input.memberId || r.query.memberId;
    if (!memberId) {
      s.status(400).json({error: "Missing memberId"});
      return;
    }
    const ok = await domain.revokePropertyMember(ctx.appProfileId, memberId);
    if (!ok) {
      s.status(404).json({error: "Member not found"});
      return;
    }
    s.status(200).json({ok: true});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});

export const revokePropertyInvite = onRequest(FN_OPTS, async (req, res) => {
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
    const input = parseBody<{inviteId?: string}>(r.body);
    const inviteId = input.inviteId || r.query.inviteId;
    if (!inviteId) {
      s.status(400).json({error: "Missing inviteId"});
      return;
    }
    const ok = await domain.revokePropertyInvite(ctx.appProfileId, inviteId);
    if (!ok) {
      s.status(404).json({error: "Invite not found"});
      return;
    }
    s.status(200).json({ok: true});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
