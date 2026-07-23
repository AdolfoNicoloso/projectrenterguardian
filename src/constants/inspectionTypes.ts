/**
 * Canonical inspection types and user-facing copy.
 * Keep in sync with functions validation allowlist.
 */

export const INSPECTION_TYPES = [
  {
    value: 'tour',
    label: 'Tour',
    shortDescription: 'Document a viewing or walkthrough before signing.',
  },
  {
    value: 'move_in',
    label: 'Move-in',
    shortDescription: 'Document condition when you move in.',
  },
  {
    value: 'periodic',
    label: 'Periodic check',
    shortDescription: 'Capture condition during your tenancy.',
  },
  {
    value: 'damage_assessment',
    label: 'Damage assessment',
    shortDescription: 'Focus on specific damage or concerns.',
  },
  {
    value: 'move_out',
    label: 'Move-out',
    shortDescription: 'Document condition when you leave.',
  },
] as const;

export type InspectionTypeValue = (typeof INSPECTION_TYPES)[number]['value'];

export const INSPECTION_TYPE_VALUES: InspectionTypeValue[] = INSPECTION_TYPES.map(
  (t) => t.value
);

export function isValidInspectionType(value: string): value is InspectionTypeValue {
  return (INSPECTION_TYPE_VALUES as string[]).includes(value);
}

export function getInspectionTypeLabel(type?: string | null): string {
  if (!type) return 'Inspection';
  const found = INSPECTION_TYPES.find((t) => t.value === type);
  if (found) return found.label;
  // Fallback: humanize unknown snake_case
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getInspectionTypeShortDescription(type?: string | null): string {
  const found = INSPECTION_TYPES.find((t) => t.value === type);
  return found?.shortDescription || 'Document the condition of your property.';
}

export type InspectionTypeCopy = {
  introTitle: string;
  introBody: string;
  scopeTitle: string;
  scopeBody: string;
  overviewBody: string;
  spacesBody: string;
  reviewBody: string;
  completeTitle: string;
  completeBody: string;
  reportNoun: string;
};

const DEFAULT_COPY: InspectionTypeCopy = {
  introTitle: 'Welcome to your inspection',
  introBody:
    'We’ll walk room by room. Add or choose a space, capture photos and notes, then continue to the next space until you’re done. You can pause anytime and resume later.',
  scopeTitle: 'Document spaces',
  scopeBody:
    'Work one space at a time. Add a room or pick an existing one, capture it, then move on.',
  overviewBody: 'Capture overview photos of the property exterior and common areas.',
  spacesBody:
    'Capture photos of this space. When you’re ready, mark it done and we’ll ask what’s next.',
  reviewBody: 'Review what you captured and add any final notes.',
  completeTitle: 'Inspection complete',
  completeBody: 'Your documentation has been saved. You can open the report anytime.',
  reportNoun: 'inspection',
};

const TOUR_COPY: InspectionTypeCopy = {
  introTitle: 'Start your property tour',
  introBody:
    'Walk through what you saw—one space at a time. Add rooms as you go, capture condition, and keep a private record for yourself.',
  scopeTitle: 'Spaces on this tour',
  scopeBody:
    'Add the first space you want to document, or pick one that already exists. We’ll keep asking until you’re done.',
  overviewBody:
    'Capture building exterior, entry, and any shared areas you saw on the tour.',
  spacesBody:
    'Photograph this room. Focus on condition, finishes, and anything you may want to remember later.',
  reviewBody:
    'Review your tour photos and add notes about impressions, concerns, or questions for the landlord.',
  completeTitle: 'Tour documented',
  completeBody:
    'Your tour record is saved. Open the report anytime to revisit what you saw.',
  reportNoun: 'tour',
};

const TYPE_COPY: Partial<Record<InspectionTypeValue, InspectionTypeCopy>> = {
  tour: TOUR_COPY,
  move_in: {
    ...DEFAULT_COPY,
    introTitle: 'Start your move-in inspection',
    introBody:
      'Document condition as you move in—one space at a time. Add rooms as you walk, or choose ones already on the property.',
    reportNoun: 'move-in inspection',
  },
  move_out: {
    ...DEFAULT_COPY,
    introTitle: 'Start your move-out inspection',
    introBody:
      'We’ll walk room by room. If this property already has spaces, we’ll go through them one by one. You can still add a room that wasn’t documented before.',
    scopeBody:
      'Continue through remaining spaces, add any missing rooms, or finish when you’re done.',
    spacesBody:
      'Capture this space as you leave. Photos and notes help support your end-of-tenancy record.',
    reportNoun: 'move-out inspection',
  },
  damage_assessment: {
    ...DEFAULT_COPY,
    introTitle: 'Damage assessment',
    introBody:
      'Focus on the spaces that matter. Document one at a time, and add any room that isn’t listed yet.',
    reportNoun: 'damage assessment',
  },
  periodic: {
    ...DEFAULT_COPY,
    introTitle: 'Periodic check',
    introBody:
      'Walk your unit space by space. Revisit existing rooms or add new ones as needed.',
    reportNoun: 'periodic check',
  },
};

export function getInspectionTypeCopy(type?: string | null): InspectionTypeCopy {
  if (type && isValidInspectionType(type) && TYPE_COPY[type]) {
    return TYPE_COPY[type]!;
  }
  return DEFAULT_COPY;
}
