/**
 * Canonical property statuses and user-facing labels.
 * Keep in sync with functions/src/firestore/propertyStatuses.ts
 */

export const PROPERTY_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'touring', label: 'Touring' },
  /** Applied after touring, before move-in (active). */
  { value: 'applied', label: 'Applied' },
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

export function isAppliedPropertyStatus(status?: string | null): boolean {
  return (status || '').toLowerCase() === 'applied';
}

/** Tours hub: touring or applied (pre–move-in pipeline). */
export function isToursHubPropertyStatus(status?: string | null): boolean {
  const s = (status || '').toLowerCase();
  return s === 'touring' || s === 'applied';
}

/** Active: any inspection. Touring / Applied: tour only. */
export function canPropertyStartInspectionType(
  status: string | null | undefined,
  inspectionType: string
): boolean {
  const s = (status || '').toLowerCase();
  if (s === 'active') return true;
  if (s === 'touring' || s === 'applied') return inspectionType === 'tour';
  return false;
}

/** Full mailing-style address from free text or structured fields. */
export function formatPropertyAddress(property: {
  address_free_text?: string | null;
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state_code?: string | null;
  zip?: number | string | null;
}): string {
  const free = property.address_free_text?.trim();
  if (free) return free;

  const street = property.street?.trim();
  const unit = property.unit?.trim();
  const city = property.city?.trim();
  const state = property.state_code?.trim();
  const zip =
    property.zip != null && String(property.zip).trim() !== ''
      ? String(property.zip).trim()
      : '';

  const line1 = [street, unit ? `Unit ${unit}` : null].filter(Boolean).join(', ');
  const cityStateZip =
    city && (state || zip)
      ? `${city}, ${[state, zip].filter(Boolean).join(' ')}`
      : [city, state, zip].filter(Boolean).join(', ');

  return [line1, cityStateZip].filter(Boolean).join(', ');
}

/**
 * Primary label for a property: custom nickname if set, otherwise the complete address.
 */
export function propertyDisplayName(property: {
  nickname?: string | null;
  address_free_text?: string | null;
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state_code?: string | null;
  zip?: number | string | null;
}): string {
  const address = formatPropertyAddress(property);
  const nickname = property.nickname?.trim();
  // Nickname replaces the address only when the user set a distinct value.
  if (nickname && nickname !== address) return nickname;
  return address || 'this property';
}

/** True when the user has set a nickname that is not just the address. */
export function propertyHasCustomNickname(property: {
  nickname?: string | null;
  address_free_text?: string | null;
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state_code?: string | null;
  zip?: number | string | null;
}): boolean {
  const nickname = property.nickname?.trim();
  if (!nickname) return false;
  const address = formatPropertyAddress(property);
  return Boolean(address ? nickname !== address : true);
}
