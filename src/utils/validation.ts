/**
 * Validation utilities for form inputs and data.
 * Centralized validation logic to avoid duplication.
 */

/**
 * Validates an email address.
 * @param email - The email to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.trim().length === 0) {
    return false;
  }
  
  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a password.
 * @param password - The password to validate
 * @param minLength - Minimum length (default: 6)
 * @returns true if valid, false otherwise
 */
export function isValidPassword(password: string, minLength: number = 6): boolean {
  if (!password || password.length < minLength) {
    return false;
  }
  return true;
}

/**
 * Checks if a required field is filled.
 * @param value - The value to check
 * @returns true if filled, false otherwise
 */
export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/**
 * Validates multiple required fields at once.
 * @param fields - Object with field names as keys and values to check
 * @returns Object with field names as keys and boolean validation results
 * 
 * @example
 * const results = validateRequired({
 *   email: formData.email,
 *   password: formData.password,
 * });
 * // { email: true, password: false }
 */
export function validateRequired(fields: Record<string, string | null | undefined>): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    results[key] = isRequired(value);
  }
  return results;
}

/**
 * Gets the first invalid required field name.
 * @param fields - Object with field names as keys and values to check
 * @returns The first invalid field name, or null if all are valid
 * 
 * @example
 * const invalid = getFirstInvalidRequired({
 *   email: formData.email,
 *   password: formData.password,
 * });
 * if (invalid) {
 *   setError(`Please fill in ${invalid}`);
 * }
 */
export function getFirstInvalidRequired(fields: Record<string, string | null | undefined>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!isRequired(value)) {
      return key;
    }
  }
  return null;
}

