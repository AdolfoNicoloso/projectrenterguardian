import { backendClient } from './backendClient';
import type { Space } from '../types';

/**
 * Domain service for space operations.
 * All space operations go through Firebase Functions backend.
 * Never calls Directus directly.
 */
class SpacesService {
  /**
   * Get all spaces for a property.
   * Verifies property ownership before returning spaces.
   * @param {string} propertyId The property ID.
   * @return {Promise<Space[]>} The spaces list.
   */
  async getSpaces(propertyId: string): Promise<Space[]> {
    const encodedId = encodeURIComponent(propertyId);
    const response = await backendClient.call<{ data: Space[] }>(
      `getSpaces?propertyId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data || [];
  }

  /**
   * Create a new space for a property.
   * Verifies property ownership before creating.
   * @param {object} input Space data (property, space_type, display_name).
   * @param {string} input.property The property ID.
   * @param {string} input.space_type The space type.
   * @param {string} input.display_name The display name.
   * @return {Promise<Space>} The created space.
   */
  async createSpace(input: {
    property: string;
    space_type: Space['space_type'];
    display_name: string;
    custom_space_type?: string;
  }): Promise<Space> {
    const response = await backendClient.call<{ data: Space }>('createSpace', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  }

  /**
   * Update a space.
   * Verifies property ownership before updating.
   * @param {string} spaceId The space ID.
   * @param {Partial<Space>} updates The fields to update.
   * @return {Promise<Space>} The updated space.
   */
  async updateSpace(spaceId: string, updates: Partial<Space>): Promise<Space> {
    const response = await backendClient.call<{ data: Space }>(
      'updateSpace',
      {
        method: 'PATCH',
        body: JSON.stringify({ id: spaceId, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Delete a space.
   * Verifies property ownership before deleting.
   * @param {string} spaceId The space ID.
   * @return {Promise<void>}
   */
  async deleteSpace(spaceId: string): Promise<void> {
    await backendClient.call<{ ok: boolean; message: string }>(
      'deleteSpace',
      {
        method: 'DELETE',
        body: JSON.stringify({ id: spaceId }),
      }
    );
  }
}

export const spacesService = new SpacesService();
