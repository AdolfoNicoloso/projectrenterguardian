/**
 * Allowed inspection_type values (keep in sync with client constants).
 */

export const VALID_INSPECTION_TYPES = [
  "tour",
  "move_in",
  "periodic",
  "damage_assessment",
  "move_out",
] as const;

export type InspectionType = (typeof VALID_INSPECTION_TYPES)[number];

/**
 * @param {string} value Candidate type.
 * @return {boolean} Whether the value is allowed.
 */
export function isValidInspectionType(value: string): value is InspectionType {
  return (VALID_INSPECTION_TYPES as readonly string[]).includes(value);
}
