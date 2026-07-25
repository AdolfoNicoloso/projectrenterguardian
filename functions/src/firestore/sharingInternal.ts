/**
 * Shared private helpers for property sharing (invites + members).
 */

import * as crypto from "crypto";
import {db, snapToDoc, type FsDoc} from "./db";

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SHARE_SCHEME = "renterguardian";
const DEFAULT_WEB_APP_URL = "https://project-renter-guardian.web.app";

/**
 * Public HTTPS origin for invite links (Firebase Hosting).
 * Override with WEB_APP_URL in functions/.env.
 * @return {string} Origin without trailing slash.
 */
function webAppBaseUrl(): string {
  const fromEnv =
    process.env.WEB_APP_URL ||
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    "";
  const trimmed = fromEnv.trim().replace(/\/$/, "");
  return trimmed || DEFAULT_WEB_APP_URL;
}

/**
 * @param {string} token Invite token.
 * @return {string} HTTPS invite URL for web (and app deep link fallback).
 */
export function shareUrlForToken(token: string): string {
  return `${webAppBaseUrl()}/invite/${encodeURIComponent(token)}`;
}

/**
 * Optional native deep link for users who already have the app.
 * @param {string} token Invite token.
 * @return {string} Custom-scheme URL.
 */
export function appDeepLinkForToken(token: string): string {
  return `${SHARE_SCHEME}://invite/${token}`;
}

/**
 * @return {string} Random invite token.
 */
export function newInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * @param {FsDoc} invite Invite document.
 * @return {boolean} True when anyone with the link may join.
 */
export function isOpenLinkInvite(invite: FsDoc): boolean {
  if (invite.invite_kind === "link") {
    return true;
  }
  return !invite.invite_email && !invite.invite_phone;
}

/**
 * @param {string} propertyLabel Property display name.
 * @param {string} token Invite token.
 * @param {object=} opts Message options.
 * @param {boolean=} opts.openLink Open multi-join link.
 * @param {string=} opts.role edit|view.
 * @return {string} Prefill share message.
 */
export function shareMessage(
  propertyLabel: string,
  token: string,
  opts?: {openLink?: boolean; role?: string}
): string {
  const webUrl = shareUrlForToken(token);
  if (opts?.openLink) {
    const access =
      opts.role === "edit" ? "edit access" : "view-only access";
    return (
      `Join ${propertyLabel} on Renter Guardian (${access}). ` +
      `Sign in, then open this link: ${webUrl}`
    );
  }
  return (
    `You've been invited to ${propertyLabel} on Renter Guardian. ` +
    `Open this link to accept: ${webUrl}`
  );
}

/**
 * @param {FsDoc} doc Property document.
 * @return {string} Display label.
 */
export function propertyLabel(doc: FsDoc): string {
  const nick = typeof doc.nickname === "string" ? doc.nickname.trim() : "";
  if (nick) {
    return nick;
  }
  return String(doc.address_free_text || "a property");
}

/**
 * @param {FsDoc} doc Invite doc.
 * @return {Record<string, unknown>} Client invite.
 */
export function mapInviteToClient(doc: FsDoc): Record<string, unknown> {
  const inviteKind = isOpenLinkInvite(doc) ? "link" : "contact";
  return {
    id: doc.id,
    property_id: doc.property_id,
    role: doc.role,
    status: doc.status,
    invite_kind: inviteKind,
    invite_email: doc.invite_email ?? null,
    invite_phone: doc.invite_phone ?? null,
    token: doc.token,
    invited_by_app_profile_id: doc.invited_by_app_profile_id,
    expires_at: doc.expires_at ?? null,
    date_created: doc.date_created,
    date_updated: doc.date_updated,
    share_url: typeof doc.token === "string" ?
      shareUrlForToken(doc.token) : null,
    app_deep_link: typeof doc.token === "string" ?
      appDeepLinkForToken(doc.token) : null,
  };
}

/**
 * @param {FsDoc} doc Member doc.
 * @param {Record<string, unknown>|null} profile Optional profile.
 * @return {Record<string, unknown>} Client member.
 */
export function mapMemberToClient(
  doc: FsDoc,
  profile: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    id: doc.id,
    property_id: doc.property_id,
    app_profile_id: doc.app_profile_id,
    role: doc.role,
    status: doc.status,
    invited_by_app_profile_id: doc.invited_by_app_profile_id,
    date_created: doc.date_created,
    date_updated: doc.date_updated,
    name: profile?.name ?? null,
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
  };
}

/**
 * @param {string} appProfileId Profile id.
 * @return {Promise<Object|null>} Raw profile fields or null.
 */
export async function loadProfileRaw(
  appProfileId: string
): Promise<Record<string, unknown> | null> {
  const doc = snapToDoc(
    await db().collection("app_profiles").doc(appProfileId).get()
  );
  return doc;
}
