/**
 * Canonical space types for property rooms.
 * Keep in sync with functions/src/firestore/spaceTypes.ts
 */

export const SPACE_TYPES = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'living_room', label: 'Living room' },
  { value: 'dining_room', label: 'Dining room' },
  { value: 'family_room', label: 'Family room' },
  { value: 'office', label: 'Office' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'entryway', label: 'Entryway' },
  { value: 'stairwell', label: 'Stairwell' },
  { value: 'closet', label: 'Closet' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'utility', label: 'Utility' },
  { value: 'garage', label: 'Garage' },
  { value: 'parking', label: 'Parking' },
  { value: 'basement', label: 'Basement' },
  { value: 'attic', label: 'Attic' },
  { value: 'loft', label: 'Loft' },
  { value: 'mudroom', label: 'Mudroom' },
  { value: 'storage', label: 'Storage' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'patio', label: 'Patio' },
  { value: 'deck', label: 'Deck' },
  { value: 'porch', label: 'Porch' },
  { value: 'yard', label: 'Yard' },
  { value: 'custom_space_type', label: 'Custom' },
] as const;

export type SpaceTypeValue = (typeof SPACE_TYPES)[number]['value'];

export const SPACE_TYPE_VALUES: SpaceTypeValue[] = SPACE_TYPES.map((t) => t.value);

export function isValidSpaceType(value: string): value is SpaceTypeValue {
  return (SPACE_TYPE_VALUES as string[]).includes(value);
}

export function getSpaceTypeLabel(
  type?: string | null,
  customTypeName?: string | null
): string {
  if (type === 'custom_space_type' && customTypeName?.trim()) {
    return customTypeName.trim();
  }
  const found = SPACE_TYPES.find((t) => t.value === type);
  if (found) return found.label;
  if (!type) return 'Space';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
