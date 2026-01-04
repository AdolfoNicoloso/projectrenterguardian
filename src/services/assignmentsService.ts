import { backendClient } from './backendClient';
import type { PhotoSpaceAssignment } from '../types';

/**
 * Domain service for photo-space assignment operations.
 * All assignment operations go through Firebase Functions backend.
 * Never calls Directus directly.
 */
class AssignmentsService {
  /**
   * Get all assignments for a photo.
   * Verifies property ownership before returning assignments.
   * @param {string} photoId The photo ID.
   * @return {Promise<PhotoSpaceAssignment[]>} The assignments list.
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
   * Create a new assignment.
   * Verifies property ownership before creating.
   * @param {string} photoId The photo ID.
   * @param {string} spaceId The space ID.
   * @return {Promise<PhotoSpaceAssignment>} The created assignment.
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

  /**
   * Update an assignment.
   * Verifies property ownership before updating.
   * @param {string} assignmentId The assignment ID.
   * @param {Partial<PhotoSpaceAssignment>} updates The fields to update.
   * @return {Promise<PhotoSpaceAssignment>} The updated assignment.
   */
  async updateAssignment(
    assignmentId: string,
    updates: Partial<PhotoSpaceAssignment>
  ): Promise<PhotoSpaceAssignment> {
    const response = await backendClient.call<{ data: PhotoSpaceAssignment }>(
      'updateAssignment',
      {
        method: 'PATCH',
        body: JSON.stringify({ id: assignmentId, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Delete an assignment.
   * Verifies property ownership before deleting.
   * @param {string} assignmentId The assignment ID.
   * @return {Promise<void>}
   */
  async deleteAssignment(assignmentId: string): Promise<void> {
    await backendClient.call('deleteAssignment', {
      method: 'DELETE',
      body: JSON.stringify({ id: assignmentId }),
    });
  }
}

export const assignmentsService = new AssignmentsService();

