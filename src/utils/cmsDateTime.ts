/**
 * ISO 8601 helpers for date values stored via Cloud Functions (Firestore).
 * Date-only fields use noon UTC to avoid timezone rollover at day boundaries.
 */

export function toCmsDateTimeIso(
  date: Date,
  opts?: { dateOnly?: boolean }
): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to toCmsDateTimeIso');
  }

  if (opts?.dateOnly) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    return noonUTC.toISOString();
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

export function fromCmsDateTimeIso(
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

export function formatDisplayDate(
  iso: string | null | undefined,
  mode: 'date' | 'datetime' = 'date'
): string {
  if (!iso) {
    return '';
  }

  try {
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
