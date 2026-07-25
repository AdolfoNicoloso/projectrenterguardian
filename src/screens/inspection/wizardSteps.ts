export const STEP_KEYS = [
  'intro',
  'choose_property',
  'confirm_scope',
  'capture_overview',
  'capture_spaces',
  'review',
  'complete',
] as const;

export type StepKey = typeof STEP_KEYS[number];

/** Steps shown in the guided flow (confirm_scope is legacy and auto-skipped). */
export const VISIBLE_STEP_KEYS: StepKey[] = STEP_KEYS.filter((k) => k !== 'confirm_scope');

export const STEP_TITLES: Record<StepKey, string> = {
  intro: 'Introduction',
  choose_property: 'Choose Property',
  confirm_scope: 'Preparing',
  capture_overview: 'Capture Overview',
  capture_spaces: 'Document spaces',
  review: 'Review',
  complete: 'Complete',
};

export function wizardStepsForInspection(hasProperty: boolean): StepKey[] {
  return hasProperty
    ? VISIBLE_STEP_KEYS.filter((k) => k !== 'choose_property')
    : VISIBLE_STEP_KEYS;
}

export function resolvePreviousWizardStep(
  current: StepKey,
  hasProperty: boolean
): StepKey | null {
  const steps = wizardStepsForInspection(hasProperty);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1];
}
