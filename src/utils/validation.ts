/**
 * Form validation helpers used by auth and property forms.
 */

/** Basic email format check. */
export function isValidEmail(email: string): boolean {
  if (!email || email.trim().length === 0) {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/** Password length check (default min 6). */
export function isValidPassword(
  password: string,
  minLength: number = 6
): boolean {
  return Boolean(password && password.length >= minLength);
}

/** Non-empty trimmed string. */
export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/**
 * Optional http(s) URL check. Empty / whitespace-only is valid (optional field).
 * Non-empty values must start with http:// or https:// after trim.
 */
export function isValidOptionalHttpUrl(
  value: string | null | undefined
): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
