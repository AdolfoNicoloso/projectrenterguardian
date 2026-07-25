/**
 * Domain service for photo-space assignment operations.
 * Calls Firebase Cloud Functions only (Firestore on the server).
 *
 * Note: update/delete assignment endpoints are not part of the MVP API.
 * Assignment changes go through createAssignment / photo updates / bulkAssignPhotos.
 */
import { backendClient } from './backendClient';
import type { PhotoSpaceAssignment } from '../types';

class AssignmentsService {
  /**
   * Get all assignments for a photo.
   * Requires property access before returning assignments.
   */
  async getAssignments(photoId: string): Promise<PhotoSpaceAssignment[]> {
    const encodedId = encodeURIComponent(photoId);
    const response = await backendClient.call<{ data: PhotoSpaceAssignment[] }>(
      `getAssignments?photoId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data || [];
  }

  /**
   * Create a new assignment (sets the photo's primary space).
   */
  async createAssignment(
    photoId: string,
    spaceId: string
  ): Promise<PhotoSpaceAssignment> {
    const response = await backendClient.call<{ data: PhotoSpaceAssignment }>(
      'createAssignment',
      {
        method: 'POST',
        body: JSON.stringify({ photo: photoId, space: spaceId }),
      }
    );
    return response.data;
  }
}

export const assignmentsService = new AssignmentsService();
