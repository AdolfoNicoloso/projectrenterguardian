import { backendClient } from './backendClient';
import type { Photo } from '../types';

/**
 * Domain service for photo operations.
 * Calls Firebase Cloud Functions only (Firestore/Storage on the server).
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
   * Upload a file via Cloud Function; returns a Storage media id.
   * When propertyId is set, the server requires edit access on that property.
   * @param {object} file File data.
   * @param {string} file.base64 Base64 encoded file (data URI format).
   * @param {string} file.type MIME type.
   * @param {string} file.name File name.
   * @param {string} [file.propertyId] Property id for edit-gated uploads.
   * @return {Promise<string>} The media file id.
   */
  async uploadFile(file: {
    base64: string;
    type: string;
    name: string;
    propertyId?: string;
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
   * Best-effort delete of an orphaned upload (media_files + Storage).
   * Only succeeds for files the caller uploaded.
   * @param {string} fileId Media file id from uploadFile.
   */
  async deleteUploadedFile(fileId: string): Promise<void> {
    await backendClient.call<{ ok: boolean }>('deleteUploadedFile', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  /**
   * Upload bytes then create the photo row. If createPhoto fails after a
   * successful upload, best-effort delete the orphaned media file.
   */
  async uploadAndCreatePhoto(
    file: { base64: string; type: string; name: string },
    photoData: Partial<Photo> & { property: string }
  ): Promise<Photo> {
    const fileId = await this.uploadFile({
      ...file,
      propertyId: photoData.property,
    });
    try {
      return await this.createPhoto({ ...photoData, file: fileId });
    } catch (err) {
      try {
        await this.deleteUploadedFile(fileId);
      } catch (cleanupErr) {
        console.warn('[photosService] orphan cleanup failed:', cleanupErr);
      }
      throw err;
    }
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
