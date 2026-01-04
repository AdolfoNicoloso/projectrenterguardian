import { backendClient } from './backendClient';
import type { Photo } from '../types';

/**
 * Domain service for photo operations.
 * All photo operations go through Firebase Functions backend.
 * Never calls Directus directly.
 */
class PhotosService {
  /**
   * Get all photos for a property.
   * Verifies property ownership before returning photos.
   * @param {string} propertyId The property ID.
   * @param {object} filters Optional filters.
   * @param {string} filters.status Filter by assignment status.
   * @param {string} filters.spaceId Filter by space ID.
   * @return {Promise<Photo[]>} The photos list.
   */
  async getPhotos(
    propertyId: string,
    filters?: { status?: 'unassigned' | 'assigned'; spaceId?: string }
  ): Promise<Photo[]> {
    const encodedId = encodeURIComponent(propertyId);
    let query = `getPhotos?propertyId=${encodedId}`;
    if (filters?.status) {
      query += `&status=${encodeURIComponent(filters.status)}`;
    }
    if (filters?.spaceId) {
      query += `&spaceId=${encodeURIComponent(filters.spaceId)}`;
    }
    const response = await backendClient.call<{ data: Photo[] }>(query, {
      method: 'GET',
    });
    return response.data || [];
  }

  /**
   * Get a single photo by ID.
   * Verifies property ownership before returning photo.
   * @param {string} photoId The photo ID.
   * @return {Promise<Photo>} The photo.
   */
  async getPhoto(photoId: string): Promise<Photo> {
    const encodedId = encodeURIComponent(photoId);
    const response = await backendClient.call<{ data: Photo }>(
      `getPhoto?photoId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Create a new photo.
   * Verifies property ownership before creating.
   * @param {Partial<Photo>} data Photo data (property, file, captured_at, etc.).
   * @return {Promise<Photo>} The created photo.
   */
  async createPhoto(data: Partial<Photo>): Promise<Photo> {
    const response = await backendClient.call<{ data: Photo }>('createPhoto', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * Update a photo.
   * Verifies property ownership before updating.
   * @param {string} photoId The photo ID.
   * @param {Partial<Photo>} updates The fields to update.
   * @return {Promise<Photo>} The updated photo.
   */
  async updatePhoto(photoId: string, updates: Partial<Photo>): Promise<Photo> {
    const response = await backendClient.call<{ data: Photo }>('updatePhoto', {
      method: 'PATCH',
      body: JSON.stringify({ id: photoId, ...updates }),
    });
    return response.data;
  }

  /**
   * Upload a file to Directus and return the file ID.
   * File is sent as base64 to Firebase Function which handles Directus upload.
   * @param {object} file File data.
   * @param {string} file.base64 Base64 encoded file (data URI format).
   * @param {string} file.type MIME type.
   * @param {string} file.name File name.
   * @return {Promise<string>} The Directus file ID.
   */
  async uploadFile(file: {
    base64: string;
    type: string;
    name: string;
  }): Promise<string> {
    const response = await backendClient.call<{ data: { id: string } }>(
      'uploadFile',
      {
        method: 'POST',
        body: JSON.stringify(file),
      }
    );
    return response.data.id;
  }

  /**
   * Delete a photo.
   * Verifies property ownership before deleting.
   * @param {string} photoId The photo ID.
   * @return {Promise<void>} Resolves when photo is deleted.
   */
  async deletePhoto(photoId: string): Promise<void> {
    await backendClient.call<{ ok: boolean; message?: string }>('deletePhoto', {
      method: 'POST',
      body: JSON.stringify({ id: photoId }),
    });
  }
}

export const photosService = new PhotosService();

