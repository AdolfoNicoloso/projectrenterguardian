/**
 * Allowed space_type values (keep in sync with client constants).
 */

export const VALID_SPACE_TYPES = [
  "bedroom",
  "bathroom",
  "kitchen",
  "living_room",
  "dining_room",
  "family_room",
  "office",
  "hallway",
  "entryway",
  "stairwell",
  "closet",
  "pantry",
  "laundry",
  "utility",
  "garage",
  "parking",
  "basement",
  "attic",
  "loft",
  "mudroom",
  "storage",
  "balcony",
  "patio",
  "deck",
  "porch",
  "yard",
  "custom_space_type",
] as const;

export type SpaceType = (typeof VALID_SPACE_TYPES)[number];

/**
 * @param {string} value Candidate type.
 * @return {boolean} Whether the value is allowed.
 */
export function isValidSpaceType(value: string): value is SpaceType {
  return (VALID_SPACE_TYPES as readonly string[]).includes(value);
}
