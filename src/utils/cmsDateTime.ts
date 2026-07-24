/**
 * ISO helpers for dates stored via Cloud Functions (Firestore).
 *
 * Calendar (date-only) values are stored as `YYYY-MM-DD` so they never shift
 * across timezones. Legacy noon-UTC ISO strings (`…T12:00:00.000Z`) are still
 * read by taking the YYYY-MM-DD prefix as the intended calendar day.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Extract Y-M-D from a date-only string or the date prefix of a full ISO string.
 */
export function calendarPartsFromIso(
  iso: string | null | undefined
): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const m = String(iso).trim().match(DATE_PREFIX_RE);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Add calendar months to a date-only ISO value, clamping the day to the
 * last day of the target month (Jan 31 + 1 month → Feb 28/29).
 */
export function addCalendarMonthsToDateIso(
  startISO: string,
  months: number
): string | null {
  const parts = calendarPartsFromIso(startISO);
  if (!parts || !Number.isFinite(months)) return null;
  const total = parts.year * 12 + (parts.month - 1) + Math.trunc(months);
  const year = Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12; // 0-11
  const month = monthIndex + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(parts.day, lastDay);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Derive lease end from start + term (months). Returns null if either is missing
 * or term is not a positive month count (e.g. month-by-month / unset).
 */
export function leaseEndFromStartAndTerm(
  startISO: string | null | undefined,
  termMonths: number | null | undefined
): string | null {
  if (!startISO || termMonths == null || termMonths < 1) return null;
  return addCalendarMonthsToDateIso(startISO, termMonths);
}

export function toCmsDateTimeIso(
  date: Date,
  opts?: { dateOnly?: boolean }
): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to toCmsDateTimeIso');
  }

  if (opts?.dateOnly) {
    // Persist calendar day only — no timezone ambiguity.
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  return date.toISOString();
}

/**
 * Safely derive captured_at ISO from EXIF DateTimeOriginal (or similar).
 * EXIF often uses "YYYY:MM:DD HH:MM:SS"; invalid values fall back to now.
 */
export function capturedAtFromExif(
  exifDateTimeOriginal: unknown,
  fallback: Date = new Date()
): string {
  if (typeof exifDateTimeOriginal === 'string' && exifDateTimeOriginal.trim()) {
    const normalized = exifDateTimeOriginal
      .trim()
      .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof exifDateTimeOriginal === 'number' && Number.isFinite(exifDateTimeOriginal)) {
    const parsed = new Date(exifDateTimeOriginal);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback.toISOString();
}

/**
 * Parse a stored value into a Date for pickers.
 * Date-only / noon-UTC lease strings use local calendar components so the
 * day does not roll backward in western timezones.
 */
export function fromCmsDateTimeIso(
  iso: string | null | undefined
): Date | null {
  if (!iso) {
    return null;
  }

  const trimmed = String(iso).trim();
  const dateOnly = DATE_ONLY_RE.test(trimmed);
  const parts = calendarPartsFromIso(trimmed);

  // Date-only, or legacy noon-UTC date-only storage: use calendar Y-M-D.
  if (parts && (dateOnly || /T12:00:00(?:\.000)?Z$/i.test(trimmed))) {
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime string: ${iso}`);
  }

  return date;
}

export function formatDisplayDate(
  iso: string | null | undefined,
  mode: 'date' | 'datetime' = 'date'
): string {
  if (!iso) {
    return '';
  }

  try {
    if (mode === 'date') {
      const parts = calendarPartsFromIso(iso);
      if (parts) {
        // Format from calendar parts — never via UTC midnight parse.
        const local = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
        return local.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    }

    const date = fromCmsDateTimeIso(iso);
    if (!date) {
      return '';
    }

    if (mode === 'datetime') {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

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
