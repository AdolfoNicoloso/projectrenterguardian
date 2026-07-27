import { inspectionsService } from '../services/inspectionsService';
import { photosService } from '../services/photosService';
import { spacesService } from '../services/spacesService';
import type { Property } from '../types';
import { hasTourCompleted } from './tourSchedule';

/** Minimum photos to treat a place as “looks documented” without a completed tour. */
export const TOUR_DOC_MIN_PHOTOS = 3;
/** Minimum spaces (rooms) alongside photos. */
export const TOUR_DOC_MIN_SPACES = 1;

export type TourDocumentationSignals = {
  propertyId: string;
  hasCompletedTourInspection: boolean;
  completedTourInspectionId: string | null;
  spaceCount: number;
  photoCount: number;
  /** True when activity suggests the user documented a tour. */
  looksDocumented: boolean;
};

/**
 * Aggregate inspections + spaces + photos to decide if we should nudge
 * “done documenting this tour?”
 */
export async function getTourDocumentationSignals(
  propertyId: string
): Promise<TourDocumentationSignals> {
  const [inspections, spaces, photos] = await Promise.all([
    inspectionsService.getMyInspections({ status: 'completed' }).catch(() => []),
    spacesService.getSpaces(propertyId).catch(() => []),
    photosService.getPhotos(propertyId, { fields: 'gallery' }).catch(() => []),
  ]);

  const completedTour = inspections.find(
    (i) =>
      i.property_id === propertyId &&
      i.inspection_type === 'tour' &&
      i.inspection_status === 'completed'
  );

  const spaceCount = spaces.length;
  const photoCount = photos.length;
  const hasCompletedTourInspection = !!completedTour;
  const looksDocumented =
    hasCompletedTourInspection ||
    (spaceCount >= TOUR_DOC_MIN_SPACES && photoCount >= TOUR_DOC_MIN_PHOTOS);

  return {
    propertyId,
    hasCompletedTourInspection,
    completedTourInspectionId: completedTour?.id ?? null,
    spaceCount,
    photoCount,
    looksDocumented,
  };
}

/**
 * Whether the Tours hub should offer the “done documenting?” prompt for this property.
 */
export function shouldPromptTourDocumented(property: Property): boolean {
  if (hasTourCompleted(property)) return false;
  const status = (property.status || '').toLowerCase();
  return status === 'touring' || status === 'applied';
}
