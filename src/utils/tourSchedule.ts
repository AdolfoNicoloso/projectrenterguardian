import type { Property } from '../types';
import { isAppliedPropertyStatus } from '../constants/propertyStatuses';

export function hasTourScheduledAt(property: Property): boolean {
  return (
    typeof property.tour_scheduled_at === 'string' &&
    property.tour_scheduled_at.trim().length > 0
  );
}

export function hasTourCompleted(property: Property): boolean {
  return (
    typeof property.tour_completed_at === 'string' &&
    property.tour_completed_at.trim().length > 0
  );
}

export type TourScheduleBucket = 'upcoming' | 'toured' | 'unscheduled';

/** Grace period after scheduled time before treating the tour as past. */
export const TOUR_PASSED_GRACE_MS = 60 * 60 * 1000; // 1 hour

export function getTourScheduleBucket(
  property: Property,
  nowMs = Date.now()
): TourScheduleBucket {
  if (!hasTourScheduledAt(property)) return 'unscheduled';
  const tourMs = Date.parse(property.tour_scheduled_at || '');
  if (!Number.isFinite(tourMs)) return 'unscheduled';
  return nowMs >= tourMs + TOUR_PASSED_GRACE_MS ? 'toured' : 'upcoming';
}

/**
 * Single Tours-hub stage for card badges.
 * Applied wins; confirmed tour completion beats schedule inference.
 */
export type ToursHubStageId =
  | 'applied'
  | 'scheduled'
  | 'toured'
  | 'likely_toured'
  | 'unscheduled';

export type ToursHubStage = {
  id: ToursHubStageId;
  label: string;
  variant: 'success' | 'warning' | 'default';
  /** Show tour datetime next to the badge when useful. */
  showTourAt: boolean;
};

export function getToursHubStage(
  property: Property,
  nowMs = Date.now()
): ToursHubStage {
  if (isAppliedPropertyStatus(property.status)) {
    return {
      id: 'applied',
      label: 'Applied',
      variant: 'success',
      showTourAt: false,
    };
  }

  if (hasTourCompleted(property)) {
    return {
      id: 'toured',
      label: 'Toured',
      variant: 'default',
      showTourAt: hasTourScheduledAt(property),
    };
  }

  const bucket = getTourScheduleBucket(property, nowMs);
  if (bucket === 'upcoming') {
    return {
      id: 'scheduled',
      label: 'Scheduled',
      variant: 'success',
      showTourAt: true,
    };
  }
  if (bucket === 'toured') {
    // Schedule time passed but user has not confirmed — soft signal only.
    return {
      id: 'likely_toured',
      label: 'Likely toured',
      variant: 'warning',
      showTourAt: true,
    };
  }
  return {
    id: 'unscheduled',
    label: 'Ready to tour',
    variant: 'warning',
    showTourAt: false,
  };
}

export const TOUR_SCHEDULE_BUCKET_ORDER: Record<TourScheduleBucket, number> = {
  upcoming: 0,
  toured: 1,
  unscheduled: 2,
};

/** Sort touring properties: upcoming → toured → unscheduled. */
export function sortTouringProperties(
  properties: Property[],
  nowMs = Date.now()
): Property[] {
  return [...properties].sort((a, b) => {
    const aCompleted = hasTourCompleted(a) ? 0 : 1;
    const bCompleted = hasTourCompleted(b) ? 0 : 1;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;

    const aBucket = getTourScheduleBucket(a, nowMs);
    const bBucket = getTourScheduleBucket(b, nowMs);
    const bucketDiff =
      TOUR_SCHEDULE_BUCKET_ORDER[aBucket] - TOUR_SCHEDULE_BUCKET_ORDER[bBucket];
    if (bucketDiff !== 0) return bucketDiff;

    if (aBucket === 'unscheduled') {
      const aUpdated = Date.parse(a.date_updated || a.date_created || '') || 0;
      const bUpdated = Date.parse(b.date_updated || b.date_created || '') || 0;
      return bUpdated - aUpdated;
    }

    const aTime = Date.parse(a.tour_scheduled_at || '') || 0;
    const bTime = Date.parse(b.tour_scheduled_at || '') || 0;
    return aBucket === 'upcoming' ? aTime - bTime : bTime - aTime;
  });
}

/** Local calendar day key YYYY-MM-DD for a tour ISO timestamp. */
export function tourLocalDayKey(iso: string | null | undefined): string | null {
  if (!iso || !String(iso).trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localDayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
