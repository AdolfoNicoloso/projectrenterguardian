import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppliedPropertyStatus } from '../../constants/propertyStatuses';
import type { Property } from '../../types';
import { getToursHubStage } from '../../utils/tourSchedule';
import type { ToursListFilter } from './types';

/** Device-local throttle for the Tours “tour scheduled?” boot modal. */
const TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY = 'tour_schedule_prompt_last_shown_at';
const TOUR_SCHEDULE_PROMPT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

const TOUR_DOCUMENTED_PROMPT_PREFIX = 'tour_documented_prompt_shown:';

export async function shouldShowTourSchedulePrompt(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY);
    if (!raw) return true;
    const lastShown = Date.parse(raw);
    if (!Number.isFinite(lastShown)) return true;
    return Date.now() - lastShown >= TOUR_SCHEDULE_PROMPT_THROTTLE_MS;
  } catch {
    return true;
  }
}

export async function markTourSchedulePromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_SCHEDULE_PROMPT_LAST_SHOWN_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Error persisting tour schedule prompt throttle:', err);
  }
}

/** Per-property: only prompt “done documenting?” once. */
export async function shouldShowTourDocumentedPrompt(
  propertyId: string
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(
      `${TOUR_DOCUMENTED_PROMPT_PREFIX}${propertyId}`
    );
    return !raw;
  } catch {
    return true;
  }
}

export async function markTourDocumentedPromptShown(
  propertyId: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${TOUR_DOCUMENTED_PROMPT_PREFIX}${propertyId}`,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Error persisting tour documented prompt:', err);
  }
}

export function propertyMatchesSearch(property: Property, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    property.nickname,
    property.address_free_text,
    property.street,
    property.unit,
    property.city,
    property.state_code,
    property.zip != null ? String(property.zip) : null,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function propertyMatchesToursFilter(
  property: Property,
  filter: ToursListFilter
): boolean {
  if (filter === 'applied') {
    return isAppliedPropertyStatus(property.status);
  }
  const stage = getToursHubStage(property);
  if (filter === 'scheduled') return stage.id === 'scheduled';
  // "Toured" filter includes confirmed toured and soft "likely toured".
  return stage.id === 'toured' || stage.id === 'likely_toured';
}
