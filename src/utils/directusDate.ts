/**
 * Directus Date/DateTime Utilities
 * 
 * Ensures all date values sent to Directus are ISO 8601 datetime strings.
 * For date-only fields (no time component), uses noon UTC to avoid timezone rollover issues.
 */

/**
 * Converts a Date object to an ISO 8601 datetime string for Directus.
 * 
 * @param date - The date to convert
 * @param opts - Options
 * @param opts.dateOnly - If true, normalizes to noon UTC on that calendar day (default: false)
 * @returns ISO 8601 datetime string (e.g., "2025-12-31T12:00:00.000Z")
 * 
 * @example
 * // Date with time
 * toDirectusDatetimeISO(new Date('2025-12-31T15:30:00'))
 * // Returns: "2025-12-31T15:30:00.000Z" (or equivalent UTC)
 * 
 * @example
 * // Date-only (normalizes to noon UTC)
 * toDirectusDatetimeISO(new Date('2025-12-31'), { dateOnly: true })
 * // Returns: "2025-12-31T12:00:00.000Z"
 */
export function toDirectusDatetimeISO(
  date: Date,
  opts?: { dateOnly?: boolean }
): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to toDirectusDatetimeISO');
  }

  if (opts?.dateOnly) {
    // Normalize to noon UTC to avoid timezone rollover edge cases
    // Create a new Date object with the same calendar date but at noon UTC
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create date at noon UTC
    const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    return noonUTC.toISOString();
  }

  // Return as-is (already in UTC ISO format)
  return date.toISOString();
}

/**
 * Converts a Directus ISO 8601 datetime string to a Date object.
 * 
 * @param iso - ISO 8601 datetime string or null/undefined
 * @returns Date object or null if input is null/undefined
 * 
 * @example
 * fromDirectusDatetimeISO("2025-12-31T12:00:00.000Z")
 * // Returns: Date object for Dec 31, 2025 at noon UTC
 * 
 * @example
 * fromDirectusDatetimeISO(null)
 * // Returns: null
 */
export function fromDirectusDatetimeISO(
  iso: string | null | undefined
): Date | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime string: ${iso}`);
  }

  return date;
}

/**
 * Formats an ISO 8601 datetime string for display in the UI.
 * 
 * @param iso - ISO 8601 datetime string or null
 * @param mode - Display mode: "date" for date-only, "datetime" for date + time (default: "date")
 * @returns Formatted string for display or empty string if null
 * 
 * @example
 * formatDisplayDate("2025-12-31T12:00:00.000Z", "date")
 * // Returns: "Dec 31, 2025" (locale-dependent)
 * 
 * @example
 * formatDisplayDate("2025-12-31T15:30:00.000Z", "datetime")
 * // Returns: "Dec 31, 2025, 3:30 PM" (locale-dependent)
 */
export function formatDisplayDate(
  iso: string | null | undefined,
  mode: "date" | "datetime" = "date"
): string {
  if (!iso) {
    return '';
  }

  try {
    const date = fromDirectusDatetimeISO(iso);
    if (!date) {
      return '';
    }

    if (mode === "datetime") {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    // date mode (default)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

