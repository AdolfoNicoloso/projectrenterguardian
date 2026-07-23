/**
 * Canonical property statuses.
 * Keep in sync with src/constants/propertyStatuses.ts
 */

export const PROPERTY_STATUS_VALUES = [
  "draft",
  "touring",
  "active",
  "archived",
] as const;

export type PropertyStatusValue = (typeof PROPERTY_STATUS_VALUES)[number];

/**
 * @param {string} value Candidate status.
 * @return {boolean} True if allowed.
 */
export function isValidPropertyStatus(
  value: string
): value is PropertyStatusValue {
  return (PROPERTY_STATUS_VALUES as readonly string[]).includes(
    value.toLowerCase()
  );
}

/**
 * Whether a property status may start the given inspection type.
 * Active: any type. Touring: tour only.
 * @param {string|undefined|null} status Property status.
 * @param {string} inspectionType Inspection type.
 * @return {boolean} True if allowed.
 */
export function canPropertyStartInspectionType(
  status: string | null | undefined,
  inspectionType: string
): boolean {
  const s = String(status || "").toLowerCase();
  if (s === "active") {
    return true;
  }
  if (s === "touring") {
    return inspectionType === "tour";
  }
  return false;
}
