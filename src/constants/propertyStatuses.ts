/**
 * Canonical property statuses and user-facing labels.
 * Keep in sync with functions/src/firestore/propertyStatuses.ts
 */

export const PROPERTY_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'touring', label: 'Touring' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

export type PropertyStatusValue = (typeof PROPERTY_STATUSES)[number]['value'];

export const PROPERTY_STATUS_VALUES: PropertyStatusValue[] = PROPERTY_STATUSES.map(
  (s) => s.value
);

export function isValidPropertyStatus(value: string): value is PropertyStatusValue {
  return (PROPERTY_STATUS_VALUES as string[]).includes(value.toLowerCase());
}

export function getPropertyStatusLabel(status?: string | null): string {
  if (!status) return 'N/A';
  const found = PROPERTY_STATUSES.find((s) => s.value === status.toLowerCase());
  if (found) return found.label;
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function isActivePropertyStatus(status?: string | null): boolean {
  return (status || '').toLowerCase() === 'active';
}

export function isTouringPropertyStatus(status?: string | null): boolean {
  return (status || '').toLowerCase() === 'touring';
}

/** Active: any inspection. Touring: tour only. */
export function canPropertyStartInspectionType(
  status: string | null | undefined,
  inspectionType: string
): boolean {
  const s = (status || '').toLowerCase();
  if (s === 'active') return true;
  if (s === 'touring') return inspectionType === 'tour';
  return false;
}

export function propertyDisplayName(property: {
  nickname?: string | null;
  address_free_text?: string | null;
}): string {
  const nickname = property.nickname?.trim();
  if (nickname) return nickname;
  return property.address_free_text?.trim() || 'this property';
}
