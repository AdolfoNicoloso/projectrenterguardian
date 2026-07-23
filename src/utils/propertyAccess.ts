import type { Property } from '../types';

/**
 * Whether the caller's role may mutate the property (upload, edit, etc.).
 * Missing my_role on a loaded property is treated as owner (legacy).
 * Unknown/unloaded property → not editable (fail closed).
 */
export function canEditProperty(
  property: Pick<Property, 'my_role'> | null | undefined
): boolean {
  if (property == null) return false;
  const role = property.my_role;
  return !role || role === 'owner' || role === 'edit';
}
