import type { Property } from '../types';
import { hasTourCompleted } from './tourSchedule';

export type JourneyMilestoneId =
  | 'tour_documented'
  | 'lease'
  | 'move_in'
  | 'check_in';

export type JourneyMilestone = {
  id: JourneyMilestoneId;
  label: string;
  done: boolean;
};

/**
 * Soft progress chips for Overview (tour → lease → move-in → check-in).
 */
export function getPropertyJourneyMilestones(
  property: Property
): JourneyMilestone[] {
  const status = (property.status || '').toLowerCase();
  const isActive = status === 'active';
  const hasLease =
    typeof property.lease_start_date === 'string' &&
    property.lease_start_date.trim().length > 0;
  const hasMoveInBaseline =
    typeof property.move_in_baseline_inspection_id === 'string' &&
    property.move_in_baseline_inspection_id.trim().length > 0;
  const checkInOpted =
    property.check_in_reminder_opt_in === true ||
    (typeof property.next_check_in_at === 'string' &&
      property.next_check_in_at.trim().length > 0);

  return [
    {
      id: 'tour_documented',
      label: 'Tour documented',
      done: hasTourCompleted(property) || isActive,
    },
    {
      id: 'lease',
      label: 'Lease',
      done: hasLease && isActive,
    },
    {
      id: 'move_in',
      label: 'Move-in',
      done: hasMoveInBaseline,
    },
    {
      id: 'check_in',
      label: 'Check-in',
      done: checkInOpted,
    },
  ];
}

/** True when an active rental is due (or overdue) for a check-in nudge. */
export function isCheckInDue(property: Property, nowMs = Date.now()): boolean {
  if ((property.status || '').toLowerCase() !== 'active') return false;
  if (property.check_in_reminder_opt_in !== true) return false;
  const iso = property.next_check_in_at;
  if (!iso || !String(iso).trim()) return false;
  const due = Date.parse(iso);
  if (!Number.isFinite(due)) return false;
  return nowMs >= due;
}
