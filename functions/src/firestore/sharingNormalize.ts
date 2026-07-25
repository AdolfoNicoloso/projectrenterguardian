/**
 * Invite contact normalization helpers.
 */

export type CollaboratorRole = "edit" | "view";

/**
 * @param {string} email Raw email.
 * @return {string|null} Normalized email or null.
 */
export function normalizeInviteEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@") || trimmed.length > 320) {
    return null;
  }
  return trimmed;
}

/**
 * Normalize phone to E.164-ish (+digits). US 10-digit → +1…
 * @param {string} phone Raw phone.
 * @return {string|null} Normalized phone or null.
 */
export function normalizeInvitePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}
